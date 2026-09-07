import { SignUp } from '@clerk/nextjs';
import AuthFrame from '../../../components/AuthFrame';
import { authAppearance } from '../../../components/authAppearance';

export const metadata = { title: 'Create your account · Chase Engine' };

// Creating an account does not grant access: lib/identity.js only admits an email that
// matches an active team_members row. Anyone else reaches the "not on the team" screen.
export default function Page() {
  return <AuthFrame eyebrow="New account"
    note="Use your Chase Contemporary address. Accounts that aren't on the gallery team can't open the engine.">
    <SignUp appearance={authAppearance}/>
  </AuthFrame>;
}
