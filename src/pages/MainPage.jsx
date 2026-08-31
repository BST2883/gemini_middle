import { useNavigate } from "react-router-dom";

export default function MainPage() {
  const nav = useNavigate();
  return (
    <div className="page">
      <div className="card text-center">
        <h1>📇 진로 명함 교환</h1>
        <p>구글 제미나이 스쿨 · 미래문제 해결 프로젝트</p>
        <div className="gap" />
        <button className="btn btn-primary" onClick={() => nav("/student")}>
          학생으로 입장
        </button>
        <button className="btn btn-secondary" onClick={() => nav("/teacher")}>
          교사로 입장
        </button>
      </div>
    </div>
  );
}
