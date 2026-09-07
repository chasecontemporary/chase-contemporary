import { SignIn } from '@clerk/nextjs';
import AuthFrame from '../../../components/AuthFrame';
import { authAppearance } from '../../../components/authAppearance';

export const metadata = { title: 'Sign in · Chase Engine' };

export default function Page() {
  return <AuthFrame eyebrow="Sign in"
    note="Use your gallery address — the one on the team roster. Anything else can sign up but won't open the engine.">
    <SignIn appearance={authAppearance}/>
  </AuthFrame>;
}
