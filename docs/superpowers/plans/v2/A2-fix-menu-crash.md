# A2 — Fix the Menu Crash

**Blocks:** everything. This takes the whole app down.

**Symptom:**

```
Base UI: MenuGroupContext is missing.
Menu group parts must be used within <Menu.Group> or <Menu.RadioGroup>.

  at DropdownMenuLabel (components/ui/dropdown-menu.tsx:63:5)
  at UserMenu (components/user-menu.tsx:63:9)
  at AppShell (components/app-shell.tsx:48:13)
```

The error escapes to `app/global-error.tsx`, so the user sees a white page reading **"The application failed to load"**.

**Cause:** `DropdownMenuLabel` renders `MenuPrimitive.GroupLabel`, which reads `MenuGroupContext`. Base UI requires that context to come from a `Menu.Group` ancestor. `UserMenu` renders the label as a direct child of `DropdownMenuContent`, so the context is absent and the primitive throws.

There is a second, quieter bug in the same file: `DropdownMenuItem render={<Link/>}` has the same `nativeButton` class of problem as `Button`.

---

## Task 1: Reproduce

- [ ] **Step 1: Confirm the trigger**

```bash
npm run dev
```

Sign in. The avatar renders. Open the menu — the app crashes to the white fallback.

- [ ] **Step 2: Read the primitive**

```bash
sed -n '50,75p' components/ui/dropdown-menu.tsx
```

Confirm `DropdownMenuLabel` wraps `MenuPrimitive.GroupLabel`, and that `DropdownMenuGroup` (wrapping `MenuPrimitive.Group`) is already exported.

---

## Task 2: Write the failing test

**File:** create `tests/components/user-menu.test.tsx`

This test must crash before the fix.

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserMenu } from '@/components/user-menu'
import type { SessionUser } from '@/lib/schemas/auth'

const push = vi.fn()
const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

const user: SessionUser = {
  id: 'u1',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  role: 'USER',
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('UserMenu signed out', () => {
  it('renders sign in and get started links', () => {
    render(<UserMenu user={null} />)
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Get started' })).toBeInTheDocument()
  })

  it('does not render an account menu', () => {
    render(<UserMenu user={null} />)
    expect(
      screen.queryByRole('button', { name: 'Account menu' }),
    ).not.toBeInTheDocument()
  })
})

describe('UserMenu signed in', () => {
  it('renders the avatar trigger with initials', () => {
    render(<UserMenu user={user} />)
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument()
    expect(screen.getByText('AL')).toBeInTheDocument()
  })

  it('opens without throwing', async () => {
    const u = userEvent.setup()
    render(<UserMenu user={user} />)
    await u.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(await screen.findByText('ada@example.com')).toBeInTheDocument()
  })

  it('shows the name and email in the menu', async () => {
    const u = userEvent.setup()
    render(<UserMenu user={user} />)
    await u.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
  })

  it('links to the profile page', async () => {
    const u = userEvent.setup()
    render(<UserMenu user={user} />)
    await u.click(screen.getByRole('button', { name: 'Account menu' }))
    const profile = await screen.findByRole('menuitem', { name: /Profile/ })
    expect(profile).toHaveAttribute('href', '/profile')
  })

  it('signs out and redirects home', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    const u = userEvent.setup()
    render(<UserMenu user={user} />)
    await u.click(screen.getByRole('button', { name: 'Account menu' }))
    await u.click(await screen.findByRole('menuitem', { name: /Sign out/ }))
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
    })
    expect(push).toHaveBeenCalledWith('/')
  })

  it('shows a single initial for a one-word name', () => {
    render(<UserMenu user={{ ...user, name: 'Ada' }} />)
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('caps initials at two characters', () => {
    render(<UserMenu user={{ ...user, name: 'Ada Byron King Lovelace' }} />)
    expect(screen.getByText('AB')).toBeInTheDocument()
  })
})
```

- [ ] **Step 1: Run it — expect the MenuGroupContext throw**

```bash
npx vitest run tests/components/user-menu.test.tsx --fileParallelism=false
```

Expected: the four tests that open the menu fail with `MenuGroupContext is missing`.

---

## Task 3: Fix `UserMenu`

**File:** modify `components/user-menu.tsx`

Three changes: wrap the label in a group, add `nativeButton={false}` to the `Link` menu item, and set `render` on the trigger correctly.

- [ ] **Step 1: Import the group**

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
```

- [ ] **Step 2: Replace the menu body**

```tsx
      <DropdownMenuContent align="end" className="w-56">
        {/* GroupLabel reads MenuGroupContext — it must sit inside a Group. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="font-medium">{user.name}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          nativeButton={false}
          render={<Link href="/profile" />}
        >
          <UserIcon data-icon />
          Profile
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => void signOut()}>
          <LogOut data-icon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
```

- [ ] **Step 3: Run the test again**

```bash
npx vitest run tests/components/user-menu.test.tsx --fileParallelism=false
```

Expected: 9 passed.

If `nativeButton` is rejected as an unknown prop on `DropdownMenuItem`, Base UI's `Menu.Item` does not accept it — drop it there and keep it only on `Button`.

---

## Task 4: Audit every other menu usage

The same mistake can hide elsewhere.

- [ ] **Step 1: Find all labels**

```bash
grep -rn "DropdownMenuLabel" --include="*.tsx" components app
```

- [ ] **Step 2: Confirm each has a Group ancestor**

For every hit, read five lines of surrounding context and verify a `DropdownMenuGroup` wraps it. At time of writing `user-menu.tsx` is the only consumer.

- [ ] **Step 3: Guard against regression in the primitive**

Make the requirement visible at the definition. In `components/ui/dropdown-menu.tsx`, directly above `DropdownMenuLabel`:

```tsx
/**
 * Renders Base UI's `Menu.GroupLabel`, which reads `MenuGroupContext`.
 * It MUST be wrapped in `<DropdownMenuGroup>` or Base UI throws at render
 * and the error escapes to the global error boundary.
 */
```

---

## Task 5: Verify and commit

- [ ] **Step 1: Full gate**

```bash
npm run typecheck
npx eslint app/ lib/ components/ hooks/ tests/
npm test -- --fileParallelism=false
```

Test count should be 556 + 9 = **565**.

- [ ] **Step 2: Live check**

```bash
npm run dev
```

Sign in, open the avatar menu. It should show your name, email, Profile, and Sign out — no crash. Click Profile, then sign out and confirm you land on `/`.

- [ ] **Step 3: Commit**

```bash
git add components/user-menu.tsx components/ui/dropdown-menu.tsx tests/components/user-menu.test.tsx
git commit -m "fix(ui): wrap DropdownMenuLabel in a Group to stop the app crashing

Base UI's Menu.GroupLabel reads MenuGroupContext and throws when rendered
outside Menu.Group. The throw escaped to global-error.tsx, so opening the
account menu replaced the entire app with the failure fallback.

Adds tests/components/user-menu.test.tsx (9 cases) covering both signed-in
and signed-out states."
```

---

## Exit checklist

- [ ] Opening the account menu no longer crashes
- [ ] Name, email, Profile, Sign out all render
- [ ] Profile link navigates
- [ ] Sign out clears the session and redirects to `/`
- [ ] A doc comment on `DropdownMenuLabel` states the Group requirement
- [ ] 565 tests pass
