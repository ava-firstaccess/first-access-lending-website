// Conditional Visibility Engine for Form Fields
// Based on dynamic_form_rules_exact_visible.json

export interface Condition {
  join: 'IF' | 'AND' | 'OR';
  field_text: string;
  operator: 'IS EQUAL TO' | 'IS NOT EQUAL TO' | 'IS EMPTY' | 'IS NOT EMPTY' | 'IS FILLED' | 'LESS THAN' | 'GREATER THAN' | 'STARTS WITH';
  value: string | number | null;
}

export interface VisibilityRule {
  order: number;
  action: 'show' | 'hide';
  conditions: Condition[];
  targets: { text: string; truncated: boolean }[];
}

/**
 * Normalize field names for comparison (strip prefixes, truncation markers)
 */
function normalizeFieldName(fieldName: string): string {
  return fieldName
    .toLowerCase()
    .replace(/\.\.\.$/, '') // Remove truncation marker
    .replace(/^(borrower|co-borrower|current loan|second mortgage|subject property|dec|dem|other properties|purchase) - /i, '')
    .trim();
}

/**
 * Evaluate a single condition against form data
 */
function evaluateCondition(condition: Condition, formData: Record<string, any>): boolean {
  const fieldName = condition.field_text;
  const fieldValue = formData[fieldName];
  const operator = condition.operator;
  const targetValue = condition.value;

  switch (operator) {
    case 'IS EQUAL TO':
      return fieldValue === targetValue;
    
    case 'IS NOT EQUAL TO':
      return fieldValue !== targetValue;
    
    case 'IS EMPTY':
      return fieldValue === undefined || fieldValue === null || fieldValue === '';
    
    case 'IS NOT EMPTY':
    case 'IS FILLED':
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
    
    case 'LESS THAN':
      return Number(fieldValue) < Number(targetValue);
    
    case 'GREATER THAN':
      return Number(fieldValue) > Number(targetValue);
    
    case 'STARTS WITH':
      return String(fieldValue).startsWith(String(targetValue));
    
    default:
      return false;
  }
}

/**
 * Evaluate all conditions for a rule (respecting IF/AND/OR logic)
 */
function evaluateRuleConditions(conditions: Condition[], formData: Record<string, any>): boolean {
  if (conditions.length === 0) return false;

  let result = evaluateCondition(conditions[0], formData);
  
  for (let i = 1; i < conditions.length; i++) {
    const condition = conditions[i];
    const conditionResult = evaluateCondition(condition, formData);
    
    if (condition.join === 'AND') {
      result = result && conditionResult;
    } else if (condition.join === 'OR') {
      result = result || conditionResult;
    }
  }
  
  return result;
}

/**
 * Determine if a field should be visible based on all rules
 * Rules are evaluated top-down; last matching rule wins
 */
export function isFieldVisible(
  fieldName: string,
  formData: Record<string, any>,
  rules: VisibilityRule[]
): boolean {
  // Default: visible unless explicitly hidden
  let visible = true;
  
  // Evaluate rules in order
  for (const rule of rules) {
    // Check if this rule applies to this field
    const appliesToField = rule.targets.some(target => {
      const normalizedTarget = normalizeFieldName(target.text);
      const normalizedField = normalizeFieldName(fieldName);
      return normalizedTarget === normalizedField || target.text === fieldName;
    });
    
    if (!appliesToField) continue;
    
    // Evaluate conditions
    const conditionsMet = evaluateRuleConditions(rule.conditions, formData);
    
    // Apply action if conditions met
    if (conditionsMet) {
      visible = rule.action === 'show';
    }
  }
  
  return visible;
}

/**
 * Get all visible fields for current form state
 */
export function getVisibleFields(
  allFields: string[],
  formData: Record<string, any>,
  rules: VisibilityRule[]
): Set<string> {
  const visibleFields = new Set<string>();
  
  for (const field of allFields) {
    if (isFieldVisible(field, formData, rules)) {
      visibleFields.add(field);
    }
  }
  
  return visibleFields;
}

/**
 * Check if a section is complete (all required visible fields have values)
 */
export function isSectionComplete(
  sectionFields: { name: string; required?: boolean }[],
  formData: Record<string, any>,
  rules: VisibilityRule[]
): boolean {
  for (const field of sectionFields) {
    // Skip if field is not visible
    if (!isFieldVisible(field.name, formData, rules)) continue;
    
    // Skip if field is not required
    if (field.required === false) continue;
    
    // Check if field has a value
    const value = formData[field.name];
    if (value === undefined || value === null || value === '') {
      return false;
    }
  }
  
  return true;
}
