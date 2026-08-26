export default function Login() {
  return <div className="login"><form method="POST" action="/api/login">
    <img src="/fonts/../logo.png" alt="" style={{display:'none'}}/>
    <div className="h1">CHASE CONTEMPORARY · ENGINE</div>
    <div className="sub" style={{marginBottom:34}}>ENTER ACCESS CODE</div>
    <input name="code" type="password" autoFocus />
    <button className="btn" type="submit">ENTER</button>
  </form></div>;
}
