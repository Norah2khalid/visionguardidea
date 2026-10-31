<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules

- All site copy and logo URLs live in `src/lib/content.ts`; edit text there, not in components.
- Uploaded official logos use Lovable Asset pointers; background-edited images use local imports, and the shared Logos component preserves their proportions in both placements.
- Single landing page at `/` with in-page anchors (user asked for section scrolling); admin at `/admin`.
- Barcode metadata and original images are managed from the browser using RLS; private storage permits public reads only for published barcode rows and admin-only writes. Old submissions are deprecated and new inserts revoked.
- Idea helpers compose the exact specialist prompts plus shared ownership rules and participant input locally; no AI generation is claimed without a real connection.
- Public signup is disabled; the first account that signs into `/admin` claims admin via `claim_first_admin()` RPC, later accounts get no access.
