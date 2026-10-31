# Folio integration notes

Source: the user-supplied `ai-cli-integration.zip`, package
`@codraoss/ai-cli-integration` 0.1.0, AGPL-3.0-only. The original license and README
are retained. Dependencies and generated distribution files from the ZIP are not
included.

Folio changes add image attachments, stdin prompts, restricted Codex execution,
runtime validation, bounded output files, cancellation and reliable process
termination. Catalog parsing accommodates current model/effort metadata. Grok
execution is deliberately unavailable until its image and tool-isolation contract
can be verified. The upstream unauthenticated catalog server is not used by Folio;
`companion/` supplies the authenticated application routes.

Build the Folio companion with the repository's `companion:build` script. Do not
publish this source snapshot as an unmodified upstream package.
