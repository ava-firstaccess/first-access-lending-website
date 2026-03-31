# GHL Field ID Corrections

**Date:** March 31, 2026  
**Issue:** Field IDs in route.ts don't match actual GHL custom field IDs

## Verified Corrections (54 fields matched by value)

### Borrower Fields
```typescript
'Borrower - Base Income - Monthly': 'uBIFT0h4CtFNic0oxuCW',  // Monthly base income
'Borrower - Current Address': 'gEax09qKcNqzc9u3LUO2',  // Same as propertyAddress
'Borrower - Employer Name': 'gfdiD84FwseEAkPetUtr',  // ✅ CORRECTED (was hj0k2Q4RGqXQf7PYqpaa)
'Borrower - Employment Status': 'aMUTCHErr2HdVlfNZRJf',  // ✅ CORRECTED (was iNAGV4UFWJJB4R3XCUI9)
'Borrower - Job Title': 'dKCOe2Vb8cwK1WkrsIbf',  // ✅ CORRECTED (was yJC5Q4Jk8nC8i13ZBTnn)
'Borrower - Other Income 1 Type': 'uV8XeoInJw7acVKAmHfz',
'Borrower - Other Income 2 Type': 'Q4bCzV5pvDMBHXIKO2H3',
'Borrower - Pay Type': '1St1ZXBc2WLFSQPFhgrO',  // Already correct
'Borrower - Previous Employer Name': 'cqZQn4459IN0XI7M7ZKt',
'Borrower - Previous Employer Position': 'nGRte9f4hVOzjNkInWUt',
'Borrower - Prior Address': '8mthgG6TEE3FWPJeMYfn',
'Borrower - Variable Income Types': 'rUv5xWd6bDUo2juLly3y',
```

### Co-Borrower Fields  
```typescript
'Co-Borrower - Email': 'oagZTlVMcL2jzy1PjHjz',  // ✅ CORRECTED (was 6OzCpT6YvX8aW9Yy00jh)
'Co-Borrower - Employer Name': 'sXhQ6EXOxn0HZsREf2TN',
'Co-Borrower - Employment Status': '8IoT4uwttvfETzsfEZjG',
'Co-Borrower - First Name': 'OngTKgIBaOt3ppzWcMnV',  // ✅ CORRECTED (was ck4Bfx6GvqfNBqPM4KKw)
'Co-Borrower - Job Title': 'U0yq8HGiBVSDeDo6A83P',
'Co-Borrower - Last Name': 'e1byhH0EKwAfj78lDbWg',  // ✅ CORRECTED (was M8RUeFi5O46BQDDYJqzs)
'Co-Borrower - Other Income 1 Type': 'CqXtIuXY87sBaDVq6UtN',
'Co-Borrower - Other Income 2 Type': 'M1c6gaLk1zr66blqS2ci',
'Co-Borrower - Pay Type': 'Jc6k2UHAnpOtnUuGpKVJ',
'Co-Borrower - Phone': 'RyaT3rYP0tdUPIMtx4Xo',  // ✅ CORRECTED (was IlJ7DYSCk38maCJVMRnO)
'Co-Borrower - Previous Employer Name': 'fHsGEokTK1wBMjPFUhZB',
'Co-Borrower - Previous Employer Position': 'YYPuAFrSad2tkgxkQ3sx',
'Co-Borrower - Variable Income Types': '5QUt23Fp6lbp7vmBrz0G',
```

### Current Loan Fields
```typescript
'Current Loan - First Mortgage Balance': 'MPcopVZVLkCFeaoPF6LV',  // Already correct
'Current Loan - Monthly Payment': 'EafrsHKfoYPdDIrFZJAB',  // Already correct
```

### Second Mortgage Fields
```typescript
'Second Mortgage - Balance': 'zAeZ4bfQtYDI2ck1LgUi',  // Already correct
'Second Mortgage - Interest Rate (%)': 'GWpfYQO69hZ6ZgGFIOyj',  // Already correct
```

### Assets Fields
```typescript
'Assets - Account Type': 'lvNGIbWlX0FlzFQ6hsoS',  // Already correct
'Assets - Checking/Savings Total': 'ociiBUKGlQ0SxPFYw3eT',  // Already correct
'Assets - Retirement Total': 'oBCFD4HfCk0mEv0xheP7',  // Already correct
```

### Declaration Fields
```typescript
'Dec - Borrower Bankruptcy Type': 'zBIxjUkSJTaPnAi6igrR',  // Already correct
```

### Demographics Fields
```typescript
'Dem - Borrower Sex': 'M7m4Ko7UY9WvJf2U8biE',
'Dem - Co-Borrower Sex': '6dPWNcAOxleHZ9aqQbt5',
```

### Property & Other Fields
```typescript
'Other Properties - Address 1': 'ZhiVKGeeBue3Lixmx6QU',
'Other Properties - Address 2': 'xjEkhdpAJTgsVWVLCkEq',
'Number of Other Properties': 'qInfjRFbMSLbeI3dmCHJ',
'Stated Property Value': 'LNQik0ammFBk61RJwSl0',  // Already correct
'Subject Property - Occupancy': 'DQnzQRDmFmVYzHSjzCNZ',  // Already correct
'Subject Property - Structure Type': 'lhE9uWIcp8jD11nBwdr8',  // Already correct
'creditScore': 'ONng5zFrN8SWAytTTbIq',  // Already correct
'helocDrawTerm': 'aaBg2aIKYGWgE7KpGayE',
'product': '6MuhWhwXCm1GOGMazyD2',  // Already correct
'propertyAddress': 'gEax09qKcNqzc9u3LUO2',  // Already correct
'propertyCity': 'sNRWwqWfqLIvUMDN2TEu',
'propertyState': 'sxpWnvYijRZUlM1xaUpn',
'propertyType': 'cVawq6S57Nsa3TfPnYY0',  // Already correct
'propertyValue': 'LNQik0ammFBk61RJwSl0',  // Already correct
'propertyZipcode': 'sAFIQAWKxmTaowpcnFvP',
'structureType': 'lhE9uWIcp8jD11nBwdr8',  // Already correct
```

## Fields Requiring Manual Mapping (68 fields - multiple matches)

These fields have multiple possible IDs because they share the same value (e.g., all "Yes" or "No" fields). Need to verify the correct ID by checking GHL field names directly.

### Common Yes/No Values (16+ possible IDs each)
- Borrower - Has Co-Borrower (value: "Yes")
- Current Loan - Escrowed (value: "Yes")
- Current Loan - Pay HOA (value: "Yes")
- All declaration fields (most are "Yes")
- Second Mortgage - Present (value: "Yes")
- Owns Other Properties (value: "Yes")
- etc.

### Common Integer Values (6 possible IDs for value "1")
- Borrower - Years at Employer
- Number of Dependents
- Subject Property - Units
- etc.

### Currency Values (5 possible IDs for value "500")
- Borrower - Overtime Monthly Income
- Co-Borrower - Overtime Monthly Income
- Second Mortgage - Monthly Payment
- etc.

## Next Steps

1. **Apply verified corrections** - Update route.ts with the 54 confirmed field IDs
2. **Test with new submission** - Verify corrected fields now appear in GHL
3. **Manual verification needed** - For the 68 ambiguous fields, need to inspect GHL field names to find correct IDs

## How to Find Correct IDs for Ambiguous Fields

Since API doesn't expose field names, you need to:
1. Open GHL opportunity in UI
2. Find the field by name (e.g., "Borrower - Has Co-Borrower")
3. Inspect element in browser DevTools
4. Look for `data-field-id` or similar attribute
5. Update mapping with correct ID

OR

Submit a test with unique values for each field to avoid collisions.
