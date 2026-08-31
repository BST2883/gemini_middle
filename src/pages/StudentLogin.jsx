import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

function hashPassword(pw) {
  let hash = 0;
  for (let i = 0; i < pw.length; i++) {
    hash = (hash * 31 + pw.charCodeAt(i)) & 0xffffffff;
  }
  return hash.toString(16);
}

export default function StudentLogin() {
  const nav = useNavigate();
  const [classCode, setClassCode] = useState("");
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!classCode.trim() || !name.trim() || !pw.trim()) {
      setError("클래스 코드, 이름, 비밀번호를 모두 입력해주세요.");
      return;
    }
    const pwDigits = pw.trim().replace(/\D/g, "");
    if (pwDigits.length < 4 || pwDigits.length > 6 || pw.trim() !== pwDigits) {
      setError("비밀번호는 숫자 4~6자리만 사용할 수 있습니다.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const classSnap = await getDoc(doc(db, "classes", classCode.trim()));
      if (!classSnap.exists()) {
        setError("클래스 코드를 다시 확인해주세요.");
        setLoading(false);
        return;
      }

      const studentId = `${classCode.trim()}_${name.trim()}`;
      const studentRef = doc(db, "students", studentId);
      const studentSnap = await getDoc(studentRef);
      const pwHash = hashPassword(pw.trim());

      if (!studentSnap.exists()) {
        // 신규 학생
        await setDoc(studentRef, {
          classCode: classCode.trim(),
          name: name.trim(),
          passwordHash: pwHash,
          passwordPlain: pw.trim(),
          slideUrl: "",
          slideTitle: "",
          qrRegisteredAt: null,
          cardCount: 0,
          createdAt: new Date(),
        });
      } else {
        const data = studentSnap.data();
        if (data.passwordHash !== pwHash) {
          setError("비밀번호가 올바르지 않습니다.");
          setLoading(false);
          return;
        }
        // 재로그인 시 passwordPlain 없으면 업데이트
        if (!data.passwordPlain) {
          await updateDoc(studentRef, { passwordPlain: pw.trim() });
        }
      }
      sessionStorage.setItem("studentId", studentId);
      sessionStorage.setItem("studentName", name.trim());
      nav("/student/home");
    } catch (e) {
      setError("오류가 발생했습니다: " + e.message);
    }
    setLoading(false);
  }

  return (
    <div className="page">
      <div className="card">
        <h2>학생 입장</h2>
        <label>클래스 코드</label>
        <input
          placeholder="선생님이 알려준 코드"
          value={classCode}
          onChange={e => setClassCode(e.target.value)}
          maxLength={10}
        />
        <label>이름</label>
        <input
          placeholder="이름"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <label>비밀번호</label>
        <input
          type="password"
          inputMode="numeric"
          placeholder="숫자 4~6자리 (예: 1234 또는 123456)"
          value={pw}
          onChange={e => setPw(e.target.value)}
          maxLength={6}
        />
        <p className="text-sm" style={{ marginBottom: 12 }}>
          💡 처음 입장이면 숫자 4~6자리로 비밀번호를 새로 만드세요.<br />
          재입장이면 이전에 만든 비밀번호를 입력하세요.
        </p>
        {error && <p style={{ color: "#e63946", fontSize: "0.85rem", marginBottom: 8 }}>{error}</p>}
        <button className="btn btn-primary" onClick={handleLogin} disabled={loading}>
          {loading ? "확인 중..." : "입장하기"}
        </button>
        <button className="btn btn-secondary" onClick={() => nav("/")}>← 뒤로</button>
      </div>
    </div>
  );
}
