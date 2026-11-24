# Rodi & Bedo — Our Savings

A responsive React + Vite savings tracker connected to the existing Supabase project.

## Included
- Shared savings goals and balances (deposits minus withdrawals)
- Goal creation and deletion for household admins
- Deposit and withdrawal recording for household admins
- Read-only access for viewer accounts
- Transaction history per goal
- Mobile-friendly design based on the supplied reference image

## Setup
1. Install Node.js (18+).
2. Copy `.env.example` to `.env`.
3. Add the existing Supabase project URL and Publishable key:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Run:
   ```bash
   npm install
   npm run dev
   ```
5. Open the local URL printed by Vite.

## Important
- The household ID is currently set to the existing Rodi & Bedo household.
- Bedo's account must be a member with role `admin`.
- Rodi's account must be added to `household_members` with role `viewer` before Rodi can sign in.
- This starter uses the existing table names and columns. It assumes the current Supabase RLS policies permit the described actions. Test with both accounts before sharing the site.
- Never put a Supabase service-role/secret key in this app. Only use the publishable key.
- The app is not deployed yet; hosting is a separate step.
