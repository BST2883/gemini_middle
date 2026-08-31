import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function TeacherLogin() {
  const nav = useNavigate();
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !pw.trim()) { setError("이메일과 비밀번호를 입력해주세요."); return; }
    setLoading(true); setError("");
    try {
      if (mode === "signup") {
        if (!name.trim()) { setError("이름을 입력해주세요."); setLoading(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw.trim());
        await setDoc(doc(db, "teachers", cred.user.uid), {
          email: email.trim(),
          name: name.trim(),
          createdAt: serverTimestamp(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), pw.trim());
      }
      nav("/teacher/dashboard");
    } catch (e) {
      const msg = {
        "auth/email-already-in-use": "이미 사용 중인 이메일입니다.",
        "auth/invalid-credential": "이메일 또는 비밀번호가 올바르지 않습니다.",
        "auth/weak-password": "비밀번호는 6자 이상이어야 합니다.",
        "auth/invalid-email": "올바른 이메일 형식이 아닙니다.",
      };
      setError(msg[e.code] || e.message);
    }
    setLoading(false);
  }

  return (
    <div className="page">
      <div className="card">
        <h2>{mode === "login" ? "교사 로그인" : "교사 회원가입"}</h2>
        {mode === "signup" && (
          <>
            <label>이름</label>
            <input placeholder="이름" value={name} onChange={e => setName(e.target.value)} />
          </>
        )}
        <label>이메일</label>
        <input type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} />
        <label>비밀번호</label>
        <input type="password" placeholder="비밀번호 (6자 이상)" value={pw} onChange={e => setPw(e.target.value)} />
        {error && <p style={{ color: "#e63946", fontSize: "0.85rem" }}>{error}</p>}
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? "처리 중..." : mode === "login" ? "로그인" : "가입하기"}
        </button>
        <button className="btn btn-secondary"
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>
          {mode === "login" ? "계정이 없나요? 회원가입" : "이미 계정이 있나요? 로그인"}
        </button>
        <button className="btn btn-secondary" onClick={() => nav("/")}>← 뒤로</button>
      </div>
    </div>
  );
}
