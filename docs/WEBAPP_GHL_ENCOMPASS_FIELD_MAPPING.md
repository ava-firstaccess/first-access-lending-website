# Webapp → GHL → Encompass Master Field Mapping

**Generated:** March 31, 2026
**Source:** GHL Custom Fields API + ghl-to-encompass-mapping-v3.3.json
**Total GHL Opportunity Fields:** 271

## How to Read This Document

Each row shows the complete data flow:
1. **Webapp Form Field** - The field name used in the webapp's localStorage/form
2. **Alias** - If the form name differs from the GHL name, the alias maps it
3. **GHL Field Name** - The canonical name in GHL
4. **GHL Field ID** - The unique ID used in the GHL API
5. **GHL Type** - The field type in GHL (TEXT, RADIO, MONETORY, etc.)
6. **Encompass Field** - Where the data lands in Encompass (if mapped)
7. **Encompass ID** - The Encompass field ID


## Loan Basics

| Webapp Form Field | GHL Field Name | GHL ID | GHL Type | Encompass Field | Encompass ID |
|---|---|---|---|---|---|
| Application Date | Application Date | `0UoSSP8TCoVpcAMveBUt` | DATE | Application Date |  |
| Loan Purpose | Loan Purpose | `6MuhWhwXCm1GOGMazyD2` | SINGLE_OPTIONS | HMDA Loan Purpose |  |
| Stated Property Value | Stated Property Value | `LNQik0ammFBk61RJwSl0` | MONETORY | Subject Property Appraised Value |  |
| Lead - Stated Credit Score | Lead - Stated Credit Score | `ONng5zFrN8SWAytTTbIq` | NUMERICAL | Average Representative Credit Score |  |
| Lead - Self-Reported Credit Rating | Lead - Self-Reported Credit Rating | `XOzCZ5fZdKBLjg9UITSf` | SINGLE_OPTIONS | Less Lead-Based Paint Credit |  |
| desiredLoanAmount | Borrower - New Loan Amount (Desired) | `z7SUo9vnJSdAXe8IGost` | MONETORY | Trans Details Loan Amt |  |
| Loan Terms - Cash Out Amount | Loan Terms - Cash Out Amount | `yagxQiOYI4kRpkGxXwf1` | MONETORY | (not mapped) |  |
| helocDrawTerm | Loan Terms - HELOC Draw Term | `hrvIe3fo4W7Dmhp28QYT` | NUMERICAL | (not mapped) |  |
| helocTotalTerm | Loan Terms - HELOC Total Term | `aiFIn7JOsummPdIOoqnL` | NUMERICAL | (not mapped) |  |
| Loan Terms - CES Term | Loan Terms - CES Term | `Wz2eOLz5eX4XEVFsrlhN` | NUMERICAL | (not mapped) |  |

## Borrower - Identity

| Webapp Form Field | GHL Field Name | GHL ID | GHL Type | Encompass Field | Encompass ID |
|---|---|---|---|---|---|
| Borrower - SSN | Borrower - Social Security Number | `MtYBSTJmhH3YQEQPO7W5` | TEXT | Borr SSN |  |
| Borrower - Date of Birth | Borrower - Date of Birth | `oOyGdSGTEONkT4uiIcXz` | DATE | Borr DOB |  |
| Borrower - Citizenship Status | Borrower - Citizenship Status | `7JHMSK46IDrHbMOHTa4Y` | SINGLE_OPTIONS | Borr Declarations |  |
| Borrower - Has Co-Borrower | Borrower - Has Co-Borrower | `Cxd4P2zg8p3unOneJBrf` | RADIO | Borrower Vesting Co-Borr AKA |  |
| Borrower - Veteran | Borrower - Veteran | `Gcpu5OPNy2HsXJ9Y6i3t` | RADIO | Borr Qualifies as Veteran |  |
| Borrower - Marital Status | Borrower - Marital Status | `u8DpcmbMCpbdJ3XVcosi` | SINGLE_OPTIONS | Borr Marital Status |  |
| Number of Dependents | Number of Dependents | `izgMwhmP6Toi3ZdSKc2u` | NUMERICAL | Borr Dependent # |  |
| Ages of Dependents | Ages of Dependents | `aaBg2aIKYGWgE7KpGayE` | TEXT | Borr Dependents Ages |  |

## Borrower - Employment

| Webapp Form Field | GHL Field Name | GHL ID | GHL Type | Encompass Field | Encompass ID |
|---|---|---|---|---|---|
| Borrower - Employment Status | Borrower - Employment Status | `aMUTCHErr2HdVlfNZRJf` | MULTIPLE_OPTIONS | Borr Employer State |  |
| Borrower - Employer Name | Borrower - Employer Name | `gfdiD84FwseEAkPetUtr` | TEXT | Borr Employer Name |  |
| Borrower - Job Title | Borrower - Job Title | `dKCOe2Vb8cwK1WkrsIbf` | TEXT | Borr Employer From Title |  |
| Borrower - Pay Type | Borrower - Pay Type | `1St1ZXBc2WLFSQPFhgrO` | RADIO | Borr Employer Index Unit Type |  |
| Borrower - Hourly Rate | Borrower - Hourly Rate | `mSGGNmRbSylCC9E2OjfR` | MONETORY | Borrower Ownership Interest Type |  |
| Borrower - Years at Employer | Borrower - Years at Employer | `U5UcojqWpG9NcN2xe7cL` | TEXT | Borr Employer Fax |  |
| Borrower - Months at Employer | Borrower - Months at Employer | `QFspoBT0eJyzHeUhem6w` | TEXT | Borr Employer Fax |  |
| Borrower - Years in Line of Work | Borrower - Years in Line of Work | `BROoNWM25ilespXfPxGz` | TEXT | Borr Years in Line of Work |  |
| Borrower - Previous Employer Name | Borrower - Previous Employer Name | `cqZQn4459IN0XI7M7ZKt` | TEXT | Borr Employer Name |  |
| Borrower - Previous Employer Position | Borrower - Previous Employer Position | `nGRte9f4hVOzjNkInWUt` | TEXT | Borr Employer Position |  |
| Borrower - Years at Previous Employer | Borrower - Years at Previous Employer | `nlSSzbQb4DWEzjA8v0Ma` | TEXT | Borr Previous Employer |  |
| Borrower - Months at Previous Employer | Borrower - Months at Previous Employer | `V3hSWb717c6cyAgtK7xT` | TEXT | Borr Previous Employer |  |
| Borrower - Previous Employer Name 2 | Borrower - Previous Employer Name 2 | `Rz3znW98ObE7fXthJ75T` | TEXT | (not mapped) |  |
| Borrower - Previous Employer Position 2 | Borrower - Previous Employer Position 2 | `FKrh38XMT4IBQJFPVACv` | TEXT | (not mapped) |  |
| Borrower - Years at Previous Employer 2 | Borrower - Years at Previous Employer 2 | `vmOXzGNm1aj7TzFJ3gZm` | NUMERICAL | (not mapped) |  |
| Borrower - Months at Previous Employer 2 | Borrower - Months at Previous Employer 2 | `UNtol8XoN5maVZYZIuJC` | NUMERICAL | (not mapped) |  |

## Borrower - Income

| Webapp Form Field | GHL Field Name | GHL ID | GHL Type | Encompass Field | Encompass ID |
|---|---|---|---|---|---|
| Borrower - Base Income - Monthly | Borrower - Monthly Base Income | `uBIFT0h4CtFNic0oxuCW` | MONETORY | Borr Employer Total Monthly Income |  |
| Borrower - Self-Employed Monthly Business Income | Borrower - Self-Employed Monthly Business Income | `b9eYRJj9Trflyv0GqbPH` | MONETORY | Borr Employer Total Monthly Income |  |
| Borrower - Self-Employed 25%+ Owner | Borrower - Self-Employed 25%+ Owner | `XctjtGU4ndkkilaUCQsq` | RADIO | Borr Self Employed |  |
| Borrower - Variable Income Types | Borrower - Variable Income Types | `rUv5xWd6bDUo2juLly3y` | CHECKBOX | Income Borr Mo Income |  |
| Borrower - Overtime Monthly Income | Borrower - Overtime Monthly Income | `kB9drqMk5ochgLuK9RgM` | MONETORY | Borr Employer Overtime Pay |  |
| Borrower - Bonus Monthly Income | Borrower - Bonus Monthly Income | `qTm0oRoKt4uveqScnQMy` | MONETORY | Borr Employer Bonus Pay |  |
| Borrower - Commission Monthly Income | Borrower - Commission Monthly Income | `Zu5ypp7m51QZZ0yccH25` | MONETORY | Borr Commission |  |
| Borrower - Other Monthly Income | Borrower - Other Monthly Income | `5fM2OaWbQO6zMeIA5Nbe` | MONETORY | Borr Employer Total Monthly Income |  |
| Borrower - Other Income 1 Type | Borrower - Other Income 1 Type | `uV8XeoInJw7acVKAmHfz` | SINGLE_OPTIONS | Income Borr Other Income 1 |  |
| Borrower - Other Income 1 Amount | Borrower - Other Income 1 Amount | `CTINWWG6pBqgn0oqwDqx` | MONETORY | Income Borr Other Income 1 |  |
| Borrower - Other Income 2 Type | Borrower - Other Income 2 Type | `Q4bCzV5pvDMBHXIKO2H3` | SINGLE_OPTIONS | Income Borr Other Income 2 (User Defined) |  |
| Borrower - Other Income 2 Amount | Borrower - Other Income 2 Amount | `B3w2uYUhaY7rqQW0s4O4` | MONETORY | Income Borr Other Income 2 (User Defined) |  |
| Borrower - Other Income 3 Type | Borrower - Other Income 3 Type | `4hu2z0uHIysWRYeG1pZ9` | SINGLE_OPTIONS | Income Borr/Co-Borr Other Income 3 |  |
| Borrower - Other Income 3 Amount | Borrower - Other Income 3 Amount | `LfpxSy6PBTbRIHfebG4f` | MONETORY | Income Borr/Co-Borr Other Income 3 Mo Amt |  |

## Borrower - Housing/Address

| Webapp Form Field | GHL Field Name | GHL ID | GHL Type | Encompass Field | Encompass ID |
|---|---|---|---|---|---|
| Borrower - Housing Ownership Type | Borrower - Housing Ownership Type | `vESxuzIbgq8EfwO5uyJg` | SINGLE_OPTIONS | Borr Own/Rent Present Addr |  |
| Borrower - Years in Current Home | Borrower - Years in Current Home | `3wJ1MwoZspYBOcSY1MbZ` | TEXT | Borr Own # Yrs |  |
| Borrower - Months in Current Home | Borrower - Months in Current Home | `5yhCuT6CLsFj7btoKek9` | TEXT | Borr Own # Mos |  |
| Borrower - Primary Street Address | Borrower - Primary Street Address | `ZnteaOrxRpHGvpakt4AS` | TEXT | Borr Present Addr |  |
| Borrower - Primary Address City | Borrower - Primary Address City | `7AW7XRQiprhYaIEulRq8` | TEXT | Borr Present City |  |
| Borrower - Primary Address State | Borrower - Primary Address State | `ZVY4ecWAwRC9zASwEseS` | TEXT | Borr Present State |  |
| Borrower - Primary Address Zip | Borrower - Primary Address Zip | `lZ3ap9iuAQJVeni6y6oU` | TEXT | Borr Present Zip |  |
| Borrower - Prior Street Address | Borrower - Prior Street Address | `8mthgG6TEE3FWPJeMYfn` | TEXT | Borr Prior Addr |  |
| Borrower - Prior Address City | Borrower - Prior Address City | `cp4P9T1tVIznPa6jmncu` | TEXT | Borrower Previous City |  |
| Borrower - Prior Address - State | Borrower - Prior Address - State | `1IdHIAVbRLQgCvEFQSNB` | TEXT | Borr Previous State |  |
| Borrower - Prior Address Zip | Borrower - Prior Address Zip | `wRPo7ZnWhkpUINAw4Dvb` | TEXT | Borr Previous Zip |  |
| Borrower - Years in Prior Home | Borrower - Years in Prior Home | `3Evdm3TefwgwnDOOctiI` | TEXT | Borr Previous Addr # Yrs |  |
| Borrower - Months in Prior Home | Borrower - Months in Prior Home | `pwydwH51DHCgDDqrTflA` | TEXT | Borr Previous Addr # Mos |  |
| Borrower - Prior Housing Ownership Type | Borrower - Prior Housing Ownership Type | `SRhTgguRRSoGJhclcOri` | SINGLE_OPTIONS | Borr Residence Owned or Rented |  |

## Co-Borrower - Identity

| Webapp Form Field | GHL Field Name | GHL ID | GHL Type | Encompass Field | Encompass ID |
|---|---|---|---|---|---|
| Co-Borrower - First Name | Co-Borrower - First Name | `OngTKgIBaOt3ppzWcMnV` | TEXT | Co-Borrower First Name |  |
| Co-Borrower - Last Name | Co-Borrower - Last Name | `e1byhH0EKwAfj78lDbWg` | TEXT | Co-Borrower Last Name |  |
| Co-Borrower - Email | Co-Borrower - Email | `oagZTlVMcL2jzy1PjHjz` | TEXT | Co-Borr Email |  |
| Co-Borrower - Phone | Co-Borrower - Phone | `RyaT3rYP0tdUPIMtx4Xo` | PHONE | Co-Borr Work Phone |  |
| Co-Borrower - Social Security Number | Co-Borrower - Social Security Number | `jt1yjJ4Q0Ms1zf1F6qAH` | TEXT | Co-Borr SSN |  |
| Co-Borrower - Date of Birth | Co-Borrower - Date of Birth | `ISkPC0IRcFn1wPQfa0BZ` | DATE | Co-Borr DOB |  |
| Co-Borrower - Citizenship Status | Co-Borrower - Citizenship Status | `AKBkZPOQeC2vIf8PbHm1` | SINGLE_OPTIONS | Co-Borr Declarations |  |
| Co-Borrower - Veteran | Co-Borrower - Veteran | `tYDucgUCXkBju6DC0vAL` | RADIO | Co-Borrower Middle Name |  |

## Co-Borrower - Employment

| Webapp Form Field | GHL Field Name | GHL ID | GHL Type | Encompass Field | Encompass ID |
|---|---|---|---|---|---|
| Co-Borrower - Employment Status | Co-Borrower - Employment Status | `8IoT4uwttvfETzsfEZjG` | MULTIPLE_OPTIONS | Co-Borr Employer Fax |  |
| Co-Borrower - Employer Name | Co-Borrower - Employer Name | `sXhQ6EXOxn0HZsREf2TN` | TEXT | Co-Borr Employer Name |  |
| Co-Borrower - Job Title | Co-Borrower - Job Title | `U0yq8HGiBVSDeDo6A83P` | TEXT | Co-Borr Employer From Title |  |
| Co-Borrower - Pay Type | Co-Borrower - Pay Type | `Jc6k2UHAnpOtnUuGpKVJ` | RADIO | Co-Borr Employer Index Unit Type |  |
| Co-Borrower - Hourly Rate | Co-Borrower - Hourly Rate | `fSPR6YEsIbAWQwpZHbBl` | MONETORY | Borrower Ownership Interest Type |  |
| Co-Borrower - Years at Employer | Co-Borrower - Years at Employer | `0yqCrD5uKcpVZ9w1SpiC` | TEXT | Co-Borr Employer Fax |  |
| Co-Borrower - Months at Employer | Co-Borrower - Months at Employer | `Tq0zuoY0ZbSlZGUhmWOJ` | TEXT | Co-Borr Employer Fax |  |
| Co-Borrower - Years in Line of Work | Co-Borrower - Years in Line of Work | `7WO5A9geGWvrigw4xPDY` | TEXT | Co-Borr Years in Line of Work |  |
| Co-Borrower - Previous Employer Name | Co-Borrower - Previous Employer Name | `fHsGEokTK1wBMjPFUhZB` | TEXT | Co-Borr Employer Name |  |
| Co-Borrower - Previous Employer Position | Co-Borrower - Previous Employer Position | `YYPuAFrSad2tkgxkQ3sx` | TEXT | Co-Borr Employer Position |  |
| Co-Borrower - Years at Previous Employer | Co-Borrower - Years at Previous Employer | `4JH6GykF9bP7vvaq4PMD` | TEXT | Co-Borr Employer Fax |  |
| Co-Borrower - Months at Previous Employer | Co-Borrower - Months at Previous Employer | `qO46URjM5a7Hn30QWp2e` | TEXT | Co-Borr Employer Name |  |

## Co-Borrower - Income

| Webapp Form Field | GHL Field Name | GHL ID | GHL Type | Encompass Field | Encompass ID |
|---|---|---|---|---|---|
| Co-Borrower - Base Income - Monthly | Co-Borrower - Monthly Base Income | `97cjfss9MneF30ty6A2v` | MONETORY | Co-Borr Employer Total Monthly Income |  |
| Co-Borrower - Self-Employed Monthly Business Income | Co-Borrower - Self-Employed Monthly Business Income | `huTNdvAuDEHiHndubrqI` | MONETORY | Co-Borr Employer Total Monthly Income |  |
| Co-Borrower - Self-Employed 25%+ Owner | Co-Borrower - Self-Employed 25%+ Owner | `pGwAjCOcpTFPI8gx6CLZ` | RADIO | Co-Borr Self Employed |  |
| Co-Borrower - Variable Income Types | Co-Borrower - Variable Income Types | `5QUt23Fp6lbp7vmBrz0G` | CHECKBOX | Income Co-Borr Base Income |  |
| Co-Borrower - Overtime Monthly Income | Co-Borrower - Overtime Monthly Income | `MSY3dClApO6rUOu3NkxD` | MONETORY | Co-Borr Employer Overtime Pay |  |
| Co-Borrower - Bonus Monthly Income | Co-Borrower - Bonus Monthly Income | `21DHSwtmCbEMHed3NF6Q` | MONETORY | Co-Borr Employer Bonus Pay |  |
| Co-Borrower - Commission Monthly Income | Co-Borrower - Commission Monthly Income | `gl0yAuFu4O0XCEmDWKDx` | MONETORY | Co Borr Commission |  |
| Co-Borrower - Other Monthly Income | Co-Borrower - Other Monthly Income | `XUE5GrHZYTUQUiSRirWN` | MONETORY | Co-Borr Employer Total Monthly Income |  |
| Co-Borrower - Other Income 1 Type | Co-Borrower - Other Income 1 Type | `CqXtIuXY87sBaDVq6UtN` | SINGLE_OPTIONS | Income Co-Borr Other income 1 |  |
| Co-Borrower - Other Income 1 Amount | Co-Borrower - Other Income 1 Amount | `2WDGgQSpjW8LJxYZ9pcn` | MONETORY | Income Co-Borr Other income 1 |  |
| Co-Borrower - Other Income 2 Type | Co-Borrower - Other Income 2 Type | `M1c6gaLk1zr66blqS2ci` | SINGLE_OPTIONS | Income Co-Borr Other Income 2 (User Defined) |  |
| Co-Borrower - Other Income 2 Amount | Co-Borrower - Other Income 2 Amount | `lgPwI6b1tcQd6BCdKtGB` | MONETORY | Income Co-Borr Other Income 2 (User Defined) |  |
| Co-Borrower - Other Income 3 Type | Co-Borrower - Other Income 3 Type | `glyzpw9EvpwcrR0ioIyq` | SINGLE_OPTIONS | TQL - Coborrower 4506T Orders - Income Year 3 Total Income Co-Borrower |  |
| Co-Borrower - Other Income 3 Amount | Co-Borrower - Other Income 3 Amount | `0IKNOjGtXpe761MHcprd` | MONETORY | Income Borr/Co-Borr Other Income 3 Mo Amt |  |

## Current Loan

| Webapp Form Field | GHL Field Name | GHL ID | GHL Type | Encompass Field | Encompass ID |
|---|---|---|---|---|---|
| Current Loan - Free & Clear | Current Loan - Free & Clear | `96o5NUFeTgh4RZDfVzw0` | RADIO | Current Assigned Title |  |
| Current Loan - First Mortgage Balance | Current Loan - First Mortgage Balance | `MPcopVZVLkCFeaoPF6LV` | MONETORY | Trans Details Sub Fin First Mtg Loan Amt |  |
| Current Loan - Monthly Payment | Current Loan - Monthly Payment | `EafrsHKfoYPdDIrFZJAB` | MONETORY | Expenses Present Mtg Pymt |  |
| Current Loan - Type | Current Loan - Type | `cuexgqANOnQfgFXl5UW2` | SINGLE_OPTIONS | USDA - Loan Type |  |
| Current Loan - Term (Months) | Current Loan - Term (Months) | `L16Nhh6FLZsbSe38qdTE` | NUMERICAL | Loan Estimate - Loan Term Months |  |
| Current Loan - Interest Rate (%) | Current Loan - Interest Rate (%) | `PaI5OuFNXb5359Wusu56` | NUMERICAL | ULDD - Current Accrued Interest |  |
| Current Loan - Rate Type | Current Loan - Rate Type | `PuZtSTGlH1ai7DTo7JTS` | SINGLE_OPTIONS | Rate Lock Current Lock Date |  |
| Current Loan - Mortgage Insurance Present | Current Loan - Mortgage Insurance Present | `Z92kpVhpKdgW0u5USzGz` | RADIO | (not mapped) |  |
| Current Loan - PMI Amount | Current Loan - Mortgage Insurance Amount | `gVvIhANp3wlDtggEq9yy` | MONETORY | Expenses Proposed Mtg Ins |  |
| Current Loan - Escrowed | Current Loan - Escrowed | `M5hL6iufhnmWPSe2CBvo` | RADIO | (not mapped) |  |
| Current Loan - Pay HOA | Current Loan - Pay HOA | `XY15b4rSlFysg5ykBUBG` | RADIO | (not mapped) |  |
| Current Loan - HOA Dues | Current Loan - Monthly HOA Dues | `H4bfbnQbDdrG7bpXRmCy` | MONETORY | Expenses Proposed HOA |  |
| Current Loan - Monthly HOI | Current Loan - Monthly HOI | `okVwQfssO6jzTJZYo1fx` | MONETORY | Expenses Proposed Haz Ins |  |
| Current Loan - Monthly Taxes | Current Loan - Monthly Taxes | `FOUtMdtMUtc1Vlv9ry6f` | MONETORY | Fees Tax Per Mo |  |
| Current Loan - Rent | Current Loan - Rent | `2mrJMr8ymjKxVCGOiRsB` | MONETORY | Subject Property Rent |  |

## Second Mortgage

| Webapp Form Field | GHL Field Name | GHL ID | GHL Type | Encompass Field | Encompass ID |
|---|---|---|---|---|---|
| Second Mortgage - Present | Second Mortgage - Present | `pVJM3ObS631WLwGQ59un` | RADIO | (not mapped) |  |
| Second Mortgage - Balance | Second Mortgage - Balance | `zAeZ4bfQtYDI2ck1LgUi` | MONETORY | Liability Balance |  |
| Second Mortgage - Monthly Payment | Second Mortgage - Monthly Payment | `MC6GMt296zS8wbPyi42W` | MONETORY | Expenses Present Other Pymt |  |
| Second Mortgage - Interest Rate (%) | Second Mortgage - Interest Rate (%) | `GWpfYQO69hZ6ZgGFIOyj` | NUMERICAL | (not mapped) |  |
| Second Mortgage - Rate Type | Second Mortgage - Rate Type | `Qz02VY8UaN33bYf40vwO` | SINGLE_OPTIONS | (not mapped) |  |
| Second Mortgage - Type | Second Mortgage - Type | `zAv0qSOuARHlBTes5wK7` | SINGLE_OPTIONS | (not mapped) |  |

## Title

| Webapp Form Field | GHL Field Name | GHL ID | GHL Type | Encompass Field | Encompass ID |
|---|---|---|---|---|---|
| Title - Current Title Held As | Current Title Held As | `XwSxBHLzYSM0aSwaLrWA` | SINGLE_OPTIONS | Current Assigned Title |  |
| Title - Will Be Held As | Title Will Be Held As | `mkOz3fctvg65uCEpR62R` | SINGLE_OPTIONS | Title Will Be Full Name |  |

## Assets

| Webapp Form Field | GHL Field Name | GHL ID | GHL Type | Encompass Field | Encompass ID |
|---|---|---|---|---|---|
| Assets - Account Type | Assets - Account Type | `lvNGIbWlX0FlzFQ6hsoS` | SINGLE_OPTIONS |  |  |
| Assets - Checking/Savings Total | Assets - Checking/Savings Total | `ociiBUKGlQ0SxPFYw3eT` | MONETORY |  |  |
| Assets - Retirement Total | Assets - Retirement Accounts Total | `oBCFD4HfCk0mEv0xheP7` | MONETORY | (not mapped) |  |
| Assets - Cash Left Over End of Month | Assets - Cash Left Over End of Month | `QriJqSFFCKcYa1mrx0JQ` | MONETORY | (not mapped) |  |

## Declarations - Borrower

| Webapp Form Field | GHL Field Name | GHL ID | GHL Type | Encompass Field | Encompass ID |
|---|---|---|---|---|---|
| Dec - Judgments / Federal Debt / Delinquent | Dec - Judgments / Federal Debt / Lawsuits | `3wgGHnodHzrlAHcnFvhZ` | RADIO | (not mapped) |  |
| Dec - Borrower Co-Signer on Note | Dec - Co-Signer/Guarantor (Any Undisclosed Debt) | `Qf4sNhf9v2rOKiLH584s` | RADIO | Borr Declarations 5b F |  |
| Dec - Bankruptcy / Short Sale / Foreclosure | Dec - Bankruptcy / Short Sale / Foreclosure (Last 7 Years) | `4wwPcl4Y4H6YPBanPmXg` | RADIO | (not mapped) |  |
| Dec - Borrower Bankruptcy Type | Dec - Borrower Bankruptcy Type | `zBIxjUkSJTaPnAi6igrR` | SINGLE_OPTIONS | (not mapped) |  |
| Dec - Borrower Bankruptcy (Last 7 Years) | Dec - Borrower Bankruptcy (Last 7 Years) | `puYi5mui4huP2gl0Oic5` | RADIO | Borr Declarations B |  |
| Dec - Borrower Deed in Lieu (Last 7 Years) | Dec - Borrower Deed in Lieu (Last 7 Years) | `abI3iI0ZYf9cIspn1qyH` | RADIO | Borr Declarations 5b J |  |
| Dec - Borrower Delinquent/Default on Federal Debt | Dec - Borrower Delinquent/Default on Federal Debt | `NY8FYFizAh7dGjUeAvtx` | RADIO | Borr Declarations 5b H |  |
| Dec - Borrower Outstanding Judgments | Dec - Borrower Outstanding Judgments | `WC1uJf3v3UfMKpUyv9V6` | RADIO | Borr Declarations A |  |
| Dec - Borrower Party to Lawsuit with Financial Liability | Dec - Borrower Party to Lawsuit with Financial Liability | `UeFMmKw3fXHf9dzYJ9az` | RADIO | Borr Declarations 5b I |  |
| Dec - Borrower Property Foreclosed (Last 7 Years) | Dec - Borrower Property Foreclosed (Last 7 Years) | `8jBNNuY3WM4JHzWsWtoB` | RADIO | Borr Declarations 5b L |  |
| Dec - Borrower Short Sale / Pre-Foreclosure Sale (Last 7 Years) | Dec - Borrower Short Sale / Pre-Foreclosure Sale (Last 7 Years) | `RYVgTuWrgIcP3HbPQdKF` | RADIO | Borr Declarations 5b K |  |
| Dec - Borrower Obligated Alimony/Support | Alimony or Child Support | `IQT8vdRee4bQMOPGoxBt` | RADIO | USDA - Other Income (Alimony, Child Support, y, Pension/Retirement, Social Security, Disability, Trust Income, Notes Receivable, etc.) |  |
| Dec - Borrower Alimony/Support Amount | Alimony/Child Support Monthly Payment | `HdpChSzkTfWLajlq3UaJ` | MONETORY | Maximum Monthly Payment |  |

## Declarations - Co-Borrower

| Webapp Form Field | GHL Field Name | GHL ID | GHL Type | Encompass Field | Encompass ID |
|---|---|---|---|---|---|
| Dec - Same for Co-Borrower | Dec - Same for Co-Borrower | `jpsc8IEuD998mKE5BRln` | RADIO | Co-Borr Declarations B |  |
| Dec - Co-Borrower Bankruptcy (Last 7 Years) | Dec - Co-Borrower Bankruptcy (Last 7 Years) | `mKafAO4eX65vzSCuWZjD` | RADIO | Co-Borr Declarations B |  |
| Dec - Co-Borrower Bankruptcy Type | Dec - Co-Borrower Bankruptcy Type | `jbgMprAnfOtvl38VIigd` | SINGLE_OPTIONS | Co-Borr Bankruptcy Chapter Seven |  |
| Dec - Co-Borrower Deed in Lieu (Last 7 Years) | Dec - Co-Borrower Deed in Lieu (Last 7 Years) | `THg2fd02NOSECQ6G3j4q` | RADIO | Co-Borr Declarations 5b J |  |
| Dec - Co-Borrower Delinquent/Default on Federal Debt | Dec - Co-Borrower Delinquent/Default on Federal Debt | `9uHPX2POInZfDuxgM8Xu` | RADIO | Co-Borr Declarations 5b H |  |
| Dec - Co-Borrower Outstanding Judgments | Dec - Co-Borrower Outstanding Judgments | `E4fEHByvy6QNOB4naL5t` | RADIO | Co-Borr Declarations A |  |
| Dec - Co-Borrower Party to Lawsuit with Financial Liability | Dec - Co-Borrower Party to Lawsuit with Financial Liability | `5Zu899avmoPcz2KMhXo8` | RADIO | Co-Borr Declarations 5b I |  |
| Dec - Co-Borrower Property Foreclosed (Last 7 Years) | Dec - Co-Borrower Property Foreclosed (Last 7 Years) | `5nPrkgbNTgB7r5iaOhuR` | RADIO | Co-Borr Declarations 5b L |  |
| Dec - Co-Borrower Short Sale / Pre-Foreclosure Sale (Last 7 Years) | Dec - Co-Borrower Short Sale / Pre-Foreclosure Sale (Last 7 Years) | `YNQlEt79HBDetoCIx4YQ` | RADIO | Co-Borr Declarations 5b K |  |
| Dec - Co-Borrower Obligated Alimony/Support | Dec - Co-Borrower Obligated Alimony/Support | `87ZDhfknExfSceyIrwOQ` | RADIO | (not mapped) |  |
| Dec - Co-Borrower Alimony/Support Amount | Dec - Co-Borrower Alimony/Support Amount | `EQBNK6HAtiaUUxNwMxqP` | MONETORY | (not mapped) |  |

## Demographics

| Webapp Form Field | GHL Field Name | GHL ID | GHL Type | Encompass Field | Encompass ID |
|---|---|---|---|---|---|
| Dem - Borrower Ethnicity | Dem - Borrower Ethnicity | `uisB3ihmc3sdv493Y4qV` | SINGLE_OPTIONS | Borr Ethnicity |  |
| Dem - Borrower Ethnicity Detail | Dem - Borrower Ethnicity Detail | `AaxvWnabKj4xw8rgwwO3` | SINGLE_OPTIONS | Borr Ethnicity |  |
| Dem - Borrower Sex | Dem - Borrower Sex | `M7m4Ko7UY9WvJf2U8biE` | SINGLE_OPTIONS | co Borrower Type |  |
| Dem - Borrower  Race | Dem - Borrower Race | `9Glofn0HQJv955PYHUau` | MULTIPLE_OPTIONS | Borr Race 2003 Application |  |
| Dem - Co-Borrower Ethnicity | Dem - Co-Borrower Ethnicity | `7bhX2JWGWBfsG03fNOXB` | SINGLE_OPTIONS | Co-Borr Ethnicity |  |
| Dem - Co-Borrower Ethnicity Detail | Dem - Co-Borrower Ethnicity Detail | `GxWw1o4zXGn3pus2coQ3` | SINGLE_OPTIONS | Co-Borr Ethnicity |  |
| Dem - Co-Borrower Sex | Dem - Co-Borrower Sex | `6dPWNcAOxleHZ9aqQbt5` | SINGLE_OPTIONS | Co-Borr Sex No Co Applicant |  |
| Dem - Co-Borrower  Race | Dem - Co-Borrower Race | `l1mesQUiebpS6UPeqeGi` | MULTIPLE_OPTIONS | Co-Borr Other Asian Race |  |

## Subject Property

| Webapp Form Field | GHL Field Name | GHL ID | GHL Type | Encompass Field | Encompass ID |
|---|---|---|---|---|---|
| Subject Property - Street Address | Subject Property - Street Address | `gEax09qKcNqzc9u3LUO2` | TEXT | Subject Property Street |  |
| Subject Property - City | Subject Property - City | `sNRWwqWfqLIvUMDN2TEu` | TEXT | Subject Property City |  |
| Subject Property - State | Subject Property - State | `sxpWnvYijRZUlM1xaUpn` | TEXT | Subject Property State |  |
| Subject Property - Zip | Subject Property - Zip | `sAFIQAWKxmTaowpcnFvP` | TEXT | Subject Property Zip |  |
| Subject Property - Occupancy | Subject Property - Occupancy Use | `DQnzQRDmFmVYzHSjzCNZ` | SINGLE_OPTIONS | Subject Property Occupancy Rate |  |
| Subject Property - Units | Subject Property - Number of Units | `sjXbqICEqFBZoMJZOgDM` | NUMERICAL | Subject Property # Units |  |
| Subject Property - Structure Type | Subject Property - Structure Type | `lhE9uWIcp8jD11nBwdr8` | SINGLE_OPTIONS | Subject Property Energy Improve Structure Type |  |
| Listed For Sale (Last 6 Months) | Listed For Sale (Last 6 Months) | `d0j27Hw5pT0Ztrm8j9MH` | RADIO | VA Management - Has the Veteran been more than 30 days late on a payment in the last 6 months? |  |
| Property Type | Property Type | `cVawq6S57Nsa3TfPnYY0` | SINGLE_OPTIONS | Subject Property Type |  |

## Other Properties

| Webapp Form Field | GHL Field Name | GHL ID | GHL Type | Encompass Field | Encompass ID |
|---|---|---|---|---|---|
| Owns Other Properties | Owns Other Properties | `lTFs8vM71L5a7hAYEZww` | CHECKBOX | (not mapped) |  |
| Number of Other Properties | Number of Other Properties | `qInfjRFbMSLbeI3dmCHJ` | NUMERICAL | (not mapped) |  |
| Other Properties - Address 1 | Other Properties - Address 1 | `ZhiVKGeeBue3Lixmx6QU` | TEXT | Mortgage Property Address |  |
| Other Properties - Address 1 Escrowed | Other Properties - Address 1 Escrowed | `pfgSMahbTO1W7EciQ1a5` | RADIO | Mortgage Property Comments |  |
| Other Properties - Address 1 HOA | Other Properties - Address 1 HOA | `pOodzjTZlu4pBc3XdCno` | RADIO | (not mapped) |  |
| Other Properties - 1 Taxes - Monthly | Other Properties - 1 Taxes - Monthly | `G32hHcU17DoCapXLcEFV` | MONETORY | (not mapped) |  |
| Other Properties - 1 Insurance - Monthly | Other Properties - 1 Insurance - Monthly | `eSx2JsXef4nCxKEb3olL` | MONETORY | (not mapped) |  |
| Other Properties - 1 HOA Amount | Other Properties - 1 HOA Amount | `A2pkPXuCiiEISmG41Hw1` | MONETORY | (not mapped) |  |
| Other Properties - Address 2 | Other Properties - Address 2 | `xjEkhdpAJTgsVWVLCkEq` | TEXT | Mortgage Property Address |  |
| Other Properties - Address 2 Escrowed | Other Properties - Address 2 Escrowed | `ommoyF1gGi9Hf3ksKgQr` | RADIO | Mortgage Property Comments |  |
| Other Properties - Address 2 HOA | Other Properties - Address 2 HOA | `pVzy74Q0ioZONlubkAeF` | RADIO | (not mapped) |  |
| Other Properties - 2 Taxes - Monthly | Other Properties - 2 Taxes - Monthly | `1b1X8DrLnAMoXajAhqzW` | MONETORY | (not mapped) |  |
| Other Properties - 2 Insurance - Monthly | Other Properties - 2 Insurance - Monthly | `cBtaxLQUD6MpCsJ6oD6o` | MONETORY | (not mapped) |  |
| Other Properties - 2 HOA Amount | Other Properties - 2 HOA Amount | `ZKQwl11m5oGCz2hmzmeY` | MONETORY | (not mapped) |  |


---
**Total fields mapped:** 178
