# Technical Specification: ATS-Optimized CV Builder Architecture

## Executive Summary
This document provides an engineering and design specification for developing a CV/Resume Builder application capable of achieving **100% data extraction fidelity** across Applicant Tracking System (ATS) parsing engines (e.g., Textkernel/Sovren, RChilli, Affinda, HireAbility) and optimizing candidate ranking within enterprise recruitment platforms (e.g., Workday, Greenhouse, Lever, Ashby, iCIMS, Oracle/Taleo).

---

## 1. Document Architecture & File Compilation

### 1.1 Supported File Formats
* **Native Text PDF (`.pdf`)**: The primary recommended output format. Must be generated directly from text vector primitives with a contiguous, uncorrupted text layer (`PDFTextStream`).
* **Native Microsoft Word (`.docx`)**: Secondary output format. Must maintain a valid OpenXML structure (`w:document` / `w:body` / `w:p`).

### 1.2 Strict Prohibitions
* **No Scanned/Raster PDFs or Images (`.png`, `.jpg`)**: Forcing an Optical Character Recognition (OCR / Stage 0) pass drops field-level extraction accuracy from ~92% down to ~85%.
* **No LaTeX / Canvas-Rendered Vector Path Exports**: Canvas rendering that turns letters into visual curves or non-standard glyph streams destroys character mapping tables (`ToUnicode` CMap), causing parsers to extract empty or scrambled character strings.

---

## 2. Layout Geometry & Formatting Rules

### 2.1 Strict Single-Column Layout
* **Layout Geometry**: 100% linear, single-column top-to-bottom visual stream.
* **Failure Vector**: Multi-column layouts account for **~34% of document parsing failures**. Text extraction engines (Stage 1) extract coordinates horizontally from left to right across the full canvas width, interleaving Line 1 of Column A with Line 1 of Column B into a garbled text stream.
* **Sidebar Prohibition**: Sidebars (left or right) cause specific enterprise parsers (such as Lever) to completely drop sidebar text frames, losing up to 60% of the resume's skills and contact data.

### 2.2 Header & Footer Rules
* **Body Text Location**: Place all contact information (Name, Email, Phone, Location, LinkedIn URL) within standard body paragraphs at the very top of Page 1.
* **Header/Footer Prohibition**: **Never** place contact information inside Microsoft Word header (`header1.xml`) or footer (`footer1.xml`) nodes. Word headers/footers reside in separate XML layers that parsing engines bypass, accounting for **~22% of missing candidate data errors**.

### 2.3 Containers, Tables, and Formatting Elements
* **No Visual Tables, Frames, or Text Boxes**: Text within floating text boxes or table cells extracts out of logical reading sequence or gets bypassed entirely.
* **Font System Specifications**: Use standard system fonts only (Arial, Calibri, Times New Roman, Helvetica, Georgia). Custom web fonts or non-standard TTF/OTF fonts distort character mapping tables during PDF compilation.
* **Bullet Point Glyphs**: Use standard circular bullet glyphs (`•`, Unicode `U+2022`). Never use custom icons, winged arrows (`→`, `✓`), or emojis. Non-standard symbols produce phantom tokens during Stage 2 tokenization and can trigger section boundary errors.

---

## 3. Section Containers & Heading Specifications

### 3.1 Whitelisted Section Headers
Parsing engines rely on Stage 3 section segmentation using regex lookups and trained probabilistic classifiers against a whitelist of standard section labels. The builder must enforce exact, standard section titles:

| Permissible Section Header | Disallowed Creative Variation (Fails Boundary Detection) |
| :--- | :--- |
| **Work Experience** or **Professional Experience** | *My Career Story* / *Where I've Been* / *Value Delivered* |
| **Education** | *Academic Background* / *Learning Journey* |
| **Skills** | *Core Competencies* / *Technical Arsenal* / *Tools I Master* |
| **Certifications** | *Accreditations* / *Professional Badges* |
| **Professional Summary** | *About Me* / *Who I Am* / *My Philosophy* |

### 3.2 Impact of Non-Standard Headers
Using non-standard headers accounts for **~17% of parsing errors**. When Stage 3 boundary detection fails, the parser appends subsequent employment histories into uncategorized blocks or skips them entirely, leaving the candidate's database profile empty.

---

## 4. Date Syntax & Temporal Structure

### 4.1 Standardized Date Syntax
* **Enforced Pattern**: `Month YYYY – Month YYYY` (e.g., `January 2021 – Present` or `March 2018 – December 2020`).
* **Delimiter**: En-dash (`–`) or hyphen (`-`) with surrounding spaces.

### 4.2 Prohibited Variations
* Do not use abbreviated dot syntax (`03.2022`).
* Do not use numeric slash syntax (`03/04/12`).
* Do not omit the month (`2021 – 2023`).
* **Why**: Stage 4 Named Entity Recognition (NER) and date regex engines in systems like Workday and Taleo derive a temporal pattern from the first date entry. Inconsistent or non-standard date syntax triggers regex exceptions, miscalculating total experience metrics and flagging fake employment gaps (~15% of parsing errors).

---

## 5. Keywords, Taxonomy Alignment, and Anti-Stuffing

### 5.1 Taxonomy Mapping & Dual-Naming
* **Global Taxonomies**: Align skill names with global standards (Lightcast, ESCO, O*NET).
* **Dual-Naming Standard**: Always write both spelled-out terms and recognized acronyms together at first mention:
  * `Amazon Web Services (AWS)`
  * `Search Engine Optimization (SEO)`
  * `Project Management Professional (PMP)`
  * `Search Engine Marketing (SEM)`
* **Rationale**: Satisfies both string-matching regex filters and normalized taxonomy engines cross-walking skill variants.

### 5.2 Anti-Keyword Stuffing & Density Control
* **Density Ceiling**: 2 to 4 mentions maximum for any core skill term across the entire resume.
* **Scoring Mechanics**: Enterprise ATS engines evaluate TF-IDF (Term Frequency-Inverse Document Frequency), semantic vector embeddings, and context windows. Excess repetition triggers density anomaly flags and ranks candidates at the bottom of the recruiter queue.
* **Prohibition on White-Text Padding**: Never include hidden white text. Modern parsers strip formatting, background colors, and font styles during Stage 1 extraction, rendering hidden text as plain visible paragraphs in the recruiter UI and flagging the candidate for integrity violations.

### 5.3 Contextual Skill Anchoring
* **Rule**: Every skill listed in the "Skills" section must also appear naturally in at least one work experience bullet point.
* **Rationale**: AI triage engines (such as Workday HiredScore, Lever Talent Fit, and Ashby AI Review) weight skills higher when anchored to employment dates, job titles, and quantified achievements rather than floating in isolated skill lists.

---

## 6. Information Density & Content Organization

### 6.1 Page Count & Density Standards
* **Document Length**: 1 to 2 pages maximum. Two-page resumes perform as well as or better than one-page resumes across all experience levels.
* **Skill Quantity**: 8 to 12 focused, high-value skills categorized logically (e.g., *Languages*, *Frameworks*, *Tools*). Avoid 40+ term "skill salads".
* **Bullet Point Density**: 3 to 5 bullet points per job entry.

### 6.2 Quantified Bullet Point Structure
* **Formula**: `Action Verb` + `Scope/Context` + `Tools/Methodology` + `Quantified Result/Metric`.
* **Example**: *"Managed a cross-functional team of 12 engineers using Agile/Scrum methodologies to deploy a cloud-native analytics platform, reducing latency by 40% and generating $14M ARR in Year 1."*
* **Numerical Formatting**: Always use numeric digits (`14`, `$14M`, `40%`) rather than spelled-out words (`fourteen`). Numerals stand out visually during the recruiter's 6-to-10-second visual scan.

### 6.3 Application Form Alignment
* **Knockout Question Awareness**: Inform users that 100% of instant automated rejections are caused by form-based prescreening knockout questions (work authorization, mandatory licenses, location requirements, salary expectations), NOT by resume text algorithms. Users must complete online application form fields accurately.

---

## Summary Specification Checklist for CV Builder Developers

1. [x] **File Output**: Export clean, native text PDF or `.docx` (No scanned PDFs, images, or canvas vectors).
2. [x] **Layout**: 100% single-column layout. No sidebars, multi-column grids, tables, or floating text boxes.
3. [x] **Header**: Contact info in standard body text on Page 1. Nothing in Word headers/footers.
4. [x] **Fonts & Glyphs**: Standard system fonts (Arial, Calibri, Times New Roman, Georgia). Standard bullet dots (`•`) only.
5. [x] **Headers**: Exact section names (`Work Experience`, `Education`, `Skills`, `Certifications`, `Professional Summary`).
6. [x] **Dates**: Strict `Month YYYY – Month YYYY` syntax across all entries.
7. [x] **Skills**: 8-12 normalized skills with dual-naming (`Acronym (Full Name)`). 2-4 keyword mentions max.
8. [x] **Bullets**: Quantified metrics (`%`, `$`, digits) anchored to contextual achievements.
