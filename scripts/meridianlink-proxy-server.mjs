#!/usr/bin/env node
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';

const PROXY_PORT = Number(process.env.MERIDIANLINK_PROXY_PORT || 8787);
const PROXY_HOST = process.env.MERIDIANLINK_PROXY_HOST || '0.0.0.0';
const DEFAULT_BASE_URL = 'https://birchwood.meridianlink.com/inetapi/request_products.aspx';
const DEFAULT_INTERFACE_ID = 'FirstAccess040926';
const DEFAULT_CLIENT_IDENTIFIER_HEADER = 'Client-Identifier';
const DEFAULT_CLIENT_IDENTIFIER = 'B0';
const DEFAULT_AUTH_HEADER = 'X-MeridianLink-Proxy-Auth';
const LOCAL_ENV_FILES = ['.env.local', '.env'];
const localEnvCache = new Map();

function loadLocalEnv(fileName) {
  if (localEnvCache.has(fileName)) return localEnvCache.get(fileName);

  const filePath = path.join(process.cwd(), fileName);
  const values = {};
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      values[key] = value;
    }
  }

  localEnvCache.set(fileName, values);
  return values;
}

function getSetting(name, fallback = '') {
  if (process.env[name]) return process.env[name];
  for (const fileName of LOCAL_ENV_FILES) {
    const values = loadLocalEnv(fileName);
    if (values[name]) return values[name];
  }
  return fallback;
}

function getSecretFromFile(filePath) {
  return fs.readFileSync(filePath, 'utf8').trim();
}

function getSecret(name, fallbackLabel) {
  const filePath = getSetting(`${name}_FILE`, '');
  if (filePath) return getSecretFromFile(filePath);
  const envValue = getSetting(name, '');
  if (envValue) return envValue;
  if (process.platform === 'darwin') {
    return execFileSync('security', ['find-generic-password', '-a', 'ava', '-s', fallbackLabel, '-w'], {
      encoding: 'utf8',
    }).trim();
  }
  throw new Error(`Missing ${name}. Set ${name} or ${name}_FILE for the VPS relay.`);
}

function timingSafeMatch(a, b) {
  if (!a || !b) return false;
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function logRelay(event, details) {
  console.log(JSON.stringify({ scope: 'meridianlink-proxy', event, ...details }));
}

function readConfig() {
  const baseUrl = getSetting('BIRCHWOOD_CREDIT_BASE_URL', DEFAULT_BASE_URL);
  const interfaceId = getSetting('BIRCHWOOD_CREDIT_INTERFACE', DEFAULT_INTERFACE_ID);
  const clientIdentifierHeader = getSetting('BIRCHWOOD_CREDIT_CLIENT_IDENTIFIER_HEADER', DEFAULT_CLIENT_IDENTIFIER_HEADER);
  const clientIdentifier = getSetting('BIRCHWOOD_CREDIT_CLIENT_IDENTIFIER', DEFAULT_CLIENT_IDENTIFIER);
  const proxyAuthHeader = getSetting('MERIDIANLINK_PROXY_AUTH_HEADER', DEFAULT_AUTH_HEADER);
  const proxyAuthToken = getSetting('MERIDIANLINK_PROXY_AUTH_TOKEN', '');
  const username = getSecret('BIRCHWOOD_CREDIT_USERNAME', 'birchwood-credit-username');
  const password = getSecret('BIRCHWOOD_CREDIT_PASSWORD', 'birchwood-credit-password');

  return { baseUrl, interfaceId, clientIdentifierHeader, clientIdentifier, proxyAuthHeader, proxyAuthToken, username, password };
}

function sendText(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    ...headers,
  });
  res.end(body);
}

function collectRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      sendText(res, 200, 'ok');
      return;
    }

    if (req.method !== 'POST' || req.url !== '/meridianlink/prod-test') {
      sendText(res, 404, 'not found');
      return;
    }

    const xml = await collectRequestBody(req);
    if (!xml.trim()) {
      sendText(res, 400, 'missing XML body');
      return;
    }

    const config = readConfig();
    const incomingAuth = req.headers[String(config.proxyAuthHeader).toLowerCase()]?.toString() || '';
    logRelay('request', {
      method: req.method,
      path: req.url,
      contentLength: req.headers['content-length'] || null,
      authPresent: Boolean(incomingAuth),
    });
    if (!timingSafeMatch(incomingAuth, config.proxyAuthToken)) {
      logRelay('unauthorized', { path: req.url });
      sendText(res, 401, 'unauthorized');
      return;
    }

    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    const upstream = await fetch(config.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/xml',
        'MCL-Interface': req.headers['mcl-interface']?.toString() || config.interfaceId,
        [config.clientIdentifierHeader]: req.headers['client-identifier']?.toString() || config.clientIdentifier,
      },
      body: xml,
      cache: 'no-store',
    });

    const text = await upstream.text();
    logRelay('upstream', {
      status: upstream.status,
      contentType: upstream.headers.get('content-type') || 'text/xml; charset=utf-8',
      bytes: Buffer.byteLength(text, 'utf8'),
      host: config.baseUrl,
    });
    const contentType = upstream.headers.get('content-type') || 'text/xml; charset=utf-8';
    res.writeHead(upstream.status, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    });
    res.end(text);
  } catch (error) {
    logRelay('error', { message: error instanceof Error ? error.message : 'Unknown proxy error' });
    sendText(res, 500, error instanceof Error ? error.stack || error.message : 'Unknown proxy error');
  }
});

server.listen(PROXY_PORT, PROXY_HOST, () => {
  console.log(`MeridianLink proxy listening on http://${PROXY_HOST}:${PROXY_PORT}`);
  console.log(`POST /meridianlink/prod-test -> ${process.env.BIRCHWOOD_CREDIT_BASE_URL || DEFAULT_BASE_URL}`);
});
