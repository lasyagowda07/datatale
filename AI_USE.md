# AI Use & Development Process

## Overview

DataTale was developed with assistance from **ChatGPT (OpenAI)** as an AI programming and development partner.

AI was used throughout the project for brainstorming, implementation guidance, code generation, debugging, technical discussions, and documentation.

The development process was iterative rather than based on a single prompt. Features were implemented in checkpoints, tested locally, revised when necessary, and eventually deployed to production.

AI-generated suggestions were not treated as final decisions. The project evolved through testing, questioning assumptions, and making deliberate changes to the proposed implementations.

---

## How AI Was Used

ChatGPT assisted with:

- Breaking the original project idea into manageable development sprints.
- Designing the Next.js and FastAPI application structure.
- Implementing CSV profiling, statistical analysis, and API endpoints.
- Integrating Anthropic Claude for column classification and data storytelling.
- Developing frontend components and interactive visualizations.
- Implementing structured AI responses with Pydantic.
- Generating PDF reports with ReportLab.
- Debugging backend, frontend, and integration issues.
- Preparing the application for deployment on Vercel and Render.
- Reviewing generated reports and documenting the project.

Implementation was carried out incrementally, with each major feature tested before proceeding.

---

## Decisions and Corrections During Development

Several parts of the project changed through discussion and testing.

### 1. Choosing the AI Provider

The initial implementation plan considered different approaches to AI-assisted classification.

I ultimately chose **Anthropic Claude** as the model provider and integrated it into the backend.

I also chose to avoid introducing a second model solely to evaluate classification results, keeping the initial architecture simpler.

### 2. Keeping Users in Control of Classification

Rather than allowing the model to determine column types without oversight, I wanted users to review and correct its recommendations.

This led to three explicit classifications:

- Numeric
- Categorical
- Skip

A confidence threshold was introduced to highlight uncertain classifications, with manual overrides available before analysis.

This was especially important for numeric-looking identifiers and categorical flags.

### 3. Separating Statistics from AI Interpretation

I wanted the application to calculate statistics using Python rather than depend on an LLM to generate numerical results.

The final architecture uses **Pandas and NumPy for computation** and **Claude for interpretation**.

This separation became a central design principle of the project.

### 4. Revising Evidence Validation

During development, we introduced validation for AI-generated insights.

Testing revealed that the proposed evidence validator was too restrictive and rejected some legitimate categorical evidence formats.

I questioned whether this complexity was justified and decided to temporarily remove strict evidence verification while retaining Pydantic schema validation.

This trade-off is documented as a limitation rather than presented as a fully solved problem.

### 5. Avoiding Redundant AI Requests

During PDF implementation, I wanted the report to include the insights already generated in the application.

Instead of calling Claude again when a user downloads a report, the frontend passes the existing insights to the backend.

This reduces unnecessary API usage and avoids generating a different interpretation during export.

### 6. Choosing a Practical Deployment Architecture

We discussed whether the GitHub repository and Vercel alone were sufficient to host the application.

After reviewing the difference between source-code hosting, frontend hosting, and a running Python backend, I chose to deploy:

- Next.js on Vercel
- FastAPI on Render
- Source code on GitHub

We then configured environment variables and CORS to connect the deployed services.

### 7. Testing AI Output Against Real Data

I tested the application with datasets containing numeric values, categorical fields, identifiers, missing values, inconsistent labels, and outliers.

The generated reports helped identify areas where the AI's interpretation needed greater precision.

For example, one report's AI summary omitted missing values from an excluded column, even though the dataset-level missing-value count was correct.

This reinforced the distinction between **correct statistical computation** and **correct AI interpretation**.

---

## Development Workflow

The general workflow was:

```text
Define requirement
       |
       v
Discuss implementation options
       |
       v
Generate or revise code
       |
       v
Run locally
       |
       v
Test API and UI behavior
       |
       v
Identify issues or trade-offs
       |
       v
Revise implementation
       |
       v
Commit and deploy
```

I preferred working in small, testable checkpoints and reviewing complete file changes rather than applying many disconnected edits.

This made it easier to understand the implementation, isolate problems, and verify each stage of development.

---

## Responsibility and Verification

AI assistance accelerated implementation, but it did not replace testing or engineering judgment.

Throughout development, I made decisions about:

- Project scope and priorities
- Architecture and technology choices
- Classification behavior and user oversight
- Statistical correctness
- Validation trade-offs
- API usage and cost considerations
- Report generation behavior
- Deployment configuration

I tested the application locally and in production, reviewed generated reports, and requested corrections when implementations did not meet the intended requirements.

The final application combines AI-assisted development with human-directed design, testing, and iteration.

---

## Reflection

The most valuable part of using AI in this project was not simply generating code faster. It was being able to explore implementation options, test assumptions, identify weaknesses, and revise decisions quickly.

At the same time, the development process demonstrated that AI-generated code and AI-generated analysis both require verification.

DataTale reflects that lesson in its own design: **AI assists with interpretation, deterministic systems handle computation, and users retain control over important decisions.**

---

*This document is intended to provide transparency about the role of AI assistance in the development of DataTale.*