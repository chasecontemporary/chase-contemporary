export default function Login() {
  return <div className="login"><form method="POST" action="/api/login">
    <h1>Chase Engine</h1>
    <p>Enter your access code to continue.</p>
    <input name="code" type="password" autoFocus placeholder="Access code" />
    <button className="btn" type="submit">Continue</button>
  </form></div>;
}
