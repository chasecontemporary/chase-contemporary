import { SignIn } from '@clerk/nextjs';
import AuthFrame from '../../../components/AuthFrame';
import { authAppearance } from '../../../components/authAppearance';

export const metadata = { title: 'Sign in · Chase Engine' };

export default function Page() {
  return <AuthFrame eyebrow="Sign in"
    note="Use your gallery address. You'll get a link by email — there's no password to remember.">
    <SignIn appearance={authAppearance}/>
  </AuthFrame>;
}
