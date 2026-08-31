import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

function toEmbedUrl(url) {
  return url.replace(/\/edit.*$/, "/embed").replace(/\/pub.*$/, "/embed");
}

export default function CardView() {
  const { studentId } = useParams();
  const nav = useNavigate();
  const [student, setStudent] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getDoc(doc(db, "students", studentId)).then(snap => {
      if (!snap.exists()) { setError(true); return; }
      setStudent(snap.data());
    });
  }, [studentId]);

  if (error) return (
    <div className="page"><div className="card text-center">
      <p>존재하지 않는 명함입니다.</p>
      <button className="btn btn-secondary" onClick={() => nav("/")}>홈으로</button>
    </div></div>
  );
  if (!student) return <div className="page"><p>로딩 중...</p></div>;

  return (
    <div className="page">
      <div className="card">
        <h2>{student.name}님의 명함</h2>
        {student.slideUrl
          ? <div className="iframe-wrap"><iframe src={toEmbedUrl(student.slideUrl)} allowFullScreen title="슬라이드" /></div>
          : <p className="text-sm">아직 슬라이드가 등록되지 않았습니다.</p>
        }
        {student.slideUrl && (
          <a href={student.slideUrl} target="_blank" rel="noreferrer">
            <button className="btn btn-secondary mt">슬라이드 원본 열기</button>
          </a>
        )}
        <button className="btn btn-secondary" onClick={() => nav("/")}>홈으로</button>
      </div>
    </div>
  );
}
