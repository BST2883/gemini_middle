import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, getDocs, deleteDoc, doc, query, where } from "firebase/firestore";

const ADMIN_PW = "admin8848";

function downloadCSV(filename, headers, rows) {
  const bom = "﻿";
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminDashboard() {
  const nav = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [cards, setCards] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [tab, setTab] = useState("overview");

  async function handleLogin() {
    if (pw !== ADMIN_PW) { alert("비밀번호가 올바르지 않습니다."); return; }
    setAuthed(true);
    await reload();
  }

  async function reload() {
    const [t, cl, st, ca] = await Promise.all([
      getDocs(collection(db, "teachers")),
      getDocs(collection(db, "classes")),
      getDocs(collection(db, "students")),
      getDocs(collection(db, "cards")),
    ]);
    setTeachers(t.docs.map(d => ({ id: d.id, ...d.data() })));
    setClasses(cl.docs.map(d => ({ id: d.id, ...d.data() })));
    setStudents(st.docs.map(d => ({ id: d.id, ...d.data() })));
    setCards(ca.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function handleDeleteClass(classId, className) {
    if (!window.confirm(`"${className}" 클래스를 삭제하시겠습니까?\n학생과 명함 데이터가 모두 삭제됩니다.`)) return;
    const [sSnap, cSnap] = await Promise.all([
      getDocs(query(collection(db, "students"), where("classCode", "==", classId))),
      getDocs(query(collection(db, "cards"), where("classCode", "==", classId)))
    ]);
    await Promise.all([
      ...sSnap.docs.map(d => deleteDoc(d.ref)),
      ...cSnap.docs.map(d => deleteDoc(d.ref)),
      deleteDoc(doc(db, "classes", classId))
    ]);
    if (selectedClass === classId) setSelectedClass(null);
    await reload();
  }

  function exportAllCSV() {
    downloadCSV("전체_학생목록.csv",
      ["이름", "클래스코드", "클래스명", "학교", "학년", "반", "명함 등록", "수집 수"],
      students.map(s => {
        const cls = classes.find(c => c.id === s.classCode);
        return [s.name, s.classCode, cls?.name ?? "", cls?.school ?? "", cls?.grade ?? "", cls?.classNum ?? "",
          s.slideUrl ? "완료" : "미완료", s.cardCount ?? 0];
      })
    );
  }

  function exportFeedbackCSV() {
    const feedbacks = cards.filter(c => c.feedback);
    downloadCSV("전체_피드백.csv",
      ["수집자", "명함 주인", "클래스", "피드백 내용", "작성 시간"],
      feedbacks.map(c => {
        const cls = classes.find(cl => cl.id === c.classCode);
        return [
          c.collectorStudentId?.split("_").slice(1).join("_"),
          c.ownerName,
          cls?.name ?? c.classCode,
          c.feedback,
          c.feedbackAt?.toDate?.()?.toLocaleString("ko-KR") ?? ""
        ];
      })
    );
  }

  if (!authed) return (
    <div className="page">
      <div className="card">
        <h2>관리자 로그인</h2>
        <input type="password" placeholder="관리자 비밀번호" value={pw} onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLogin()} />
        <button className="btn btn-primary" onClick={handleLogin}>로그인</button>
        <button className="btn btn-secondary" onClick={() => nav("/")}>← 뒤로</button>
      </div>
    </div>
  );

  const feedbackCards = cards.filter(c => c.feedback);
  const classStudents = selectedClass ? students.filter(s => s.classCode === selectedClass) : [];
  const classCards = selectedClass ? cards.filter(c => c.classCode === selectedClass) : [];
  const selectedClassData = classes.find(c => c.id === selectedClass);

  return (
    <div className="page" style={{ justifyContent: "flex-start", paddingTop: 32 }}>
      <div className="card" style={{ maxWidth: 720 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>관리자 대시보드</h2>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-secondary"
              style={{ width: "auto", padding: "6px 12px", fontSize: "0.78rem" }}
              onClick={reload}>새로고침</button>
            <button className="btn btn-secondary"
              style={{ width: "auto", padding: "6px 12px", fontSize: "0.78rem" }}
              onClick={() => { setAuthed(false); setPw(""); }}>로그아웃</button>
          </div>
        </div>

        {/* 통계 요약 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, margin: "16px 0" }}>
          {[
            { label: "교사", value: teachers.length, icon: "👨‍🏫", color: "#4361ee" },
            { label: "클래스", value: classes.length, icon: "🏫", color: "#3a86ff" },
            { label: "학생", value: students.length, icon: "🎒", color: "#06d6a0" },
            { label: "명함교환", value: cards.length, icon: "🪪", color: "#f77f00" },
          ].map(s => (
            <div key={s.label} style={{
              background: s.color + "12", border: `1.5px solid ${s.color}33`,
              borderRadius: 10, padding: "12px 10px", textAlign: "center"
            }}>
              <div style={{ fontSize: "1.5rem" }}>{s.icon}</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: "0.75rem", color: "#666" }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 16 }}>
          {[
            { label: "작성된 피드백", value: feedbackCards.length, icon: "💬", color: "#8338ec" },
            { label: "명함 미등록 학생", value: students.filter(s => !s.slideUrl).length, icon: "⚠️", color: "#e63946" },
          ].map(s => (
            <div key={s.label} style={{
              background: s.color + "10", border: `1.5px solid ${s.color}33`,
              borderRadius: 10, padding: "12px 10px", textAlign: "center"
            }}>
              <div style={{ fontSize: "1.4rem" }}>{s.icon}</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: "0.75rem", color: "#666" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* CSV 내보내기 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button className="btn btn-secondary" style={{ flex: 1, fontSize: "0.85rem" }} onClick={exportAllCSV}>
            📥 전체 학생 CSV
          </button>
          <button className="btn btn-secondary" style={{ flex: 1, fontSize: "0.85rem" }} onClick={exportFeedbackCSV}
            disabled={feedbackCards.length === 0}>
            📥 전체 피드백 CSV
          </button>
        </div>

        {/* 탭 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { key: "overview", label: "교사별 현황" },
            { key: "classes", label: "클래스 상세" },
            { key: "feedbacks", label: "피드백 내역" },
          ].map(t => (
            <button key={t.key}
              className={`btn ${tab === t.key ? "btn-primary" : "btn-secondary"}`}
              style={{ flex: 1, minWidth: 100, padding: "10px 8px", fontSize: "0.85rem" }}
              onClick={() => { setTab(t.key); setSelectedClass(null); }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* 교사별 현황 */}
        {tab === "overview" && (
          <div>
            {teachers.length === 0
              ? <p className="text-sm">등록된 교사가 없습니다.</p>
              : teachers.map(teacher => {
                const tClasses = classes.filter(c => c.teacherId === teacher.id);
                const tStudents = students.filter(s => tClasses.some(c => c.id === s.classCode));
                const tCards = cards.filter(c => tClasses.some(cl => cl.id === c.classCode));
                return (
                  <div key={teacher.id} style={{
                    border: "1.5px solid #e8eaf6", borderRadius: 12, padding: 16, marginBottom: 14
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: "1rem", margin: 0 }}>{teacher.name}</p>
                        <p className="text-sm" style={{ marginTop: 2 }}>{teacher.email}</p>
                      </div>
                      <div style={{ display: "flex", gap: 8, textAlign: "center" }}>
                        {[
                          { label: "클래스", val: tClasses.length },
                          { label: "학생", val: tStudents.length },
                          { label: "교환", val: tCards.length },
                        ].map(s => (
                          <div key={s.label} style={{
                            background: "#f0f4ff", borderRadius: 8, padding: "6px 12px", minWidth: 50
                          }}>
                            <div style={{ fontWeight: 700, color: "#4361ee", fontSize: "1.1rem" }}>{s.val}</div>
                            <div style={{ fontSize: "0.72rem", color: "#666" }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {tClasses.length > 0 && (
                      <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {tClasses.map(c => (
                          <button key={c.id}
                            className="btn btn-secondary"
                            style={{ width: "auto", padding: "5px 12px", fontSize: "0.8rem" }}
                            onClick={() => { setTab("classes"); setSelectedClass(c.id); }}>
                            {c.name || c.id} ({students.filter(s => s.classCode === c.id).length}명)
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            }
          </div>
        )}

        {/* 클래스 상세 */}
        {tab === "classes" && (
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {classes.map(c => (
                <button key={c.id}
                  className={`btn ${selectedClass === c.id ? "btn-primary" : "btn-secondary"}`}
                  style={{ width: "auto", padding: "7px 14px", fontSize: "0.82rem" }}
                  onClick={() => setSelectedClass(c.id === selectedClass ? null : c.id)}>
                  {c.name || c.id}
                </button>
              ))}
            </div>

            {!selectedClass && <p className="text-sm">클래스를 선택하면 상세 정보가 표시됩니다.</p>}

            {selectedClass && selectedClassData && (
              <>
                <div style={{ background: "#f0f4ff", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <p style={{ fontWeight: 700, margin: 0 }}>{selectedClassData.name || selectedClass}</p>
                      <p className="text-sm" style={{ marginTop: 4 }}>
                        코드: <strong>{selectedClass}</strong> ·
                        학생 {classStudents.length}명 ·
                        교환 {classCards.length}건 ·
                        피드백 {classCards.filter(c => c.feedback).length}건
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteClass(selectedClass, selectedClassData.name || selectedClass)}
                      style={{
                        background: "none", border: "1.5px solid #e63946", color: "#e63946",
                        borderRadius: 8, padding: "5px 10px", fontSize: "0.78rem", cursor: "pointer"
                      }}>
                      🗑️ 삭제
                    </button>
                  </div>
                </div>

                <h3 style={{ marginBottom: 8 }}>학생 목록 ({classStudents.length}명)</h3>
                {classStudents.length === 0
                  ? <p className="text-sm">아직 입장한 학생이 없습니다.</p>
                  : (
                    <div className="table-wrap" style={{ marginBottom: 20 }}>
                      <table>
                        <thead>
                          <tr><th>이름</th><th>명함 등록</th><th>수집 수</th><th>받은 수</th><th>피드백</th></tr>
                        </thead>
                        <tbody>
                          {classStudents.map(s => {
                            const received = classCards.filter(c => c.ownerStudentId === s.id).length;
                            const fbCount = classCards.filter(c => c.ownerStudentId === s.id && c.feedback).length;
                            return (
                              <tr key={s.id}>
                                <td style={{ fontWeight: 600 }}>
                                  {s.slideUrl
                                    ? <a href={s.slideUrl} target="_blank" rel="noreferrer" style={{ color: "#4361ee" }}>{s.name}</a>
                                    : s.name}
                                </td>
                                <td>{s.slideUrl ? "✅" : <span style={{ color: "#e63946" }}>❌</span>}</td>
                                <td>{s.cardCount ?? 0}장</td>
                                <td>{received}장</td>
                                <td>{fbCount > 0 ? <span style={{ color: "#8338ec" }}>💬 {fbCount}건</span> : "-"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                }

                <h3 style={{ marginBottom: 8 }}>명함 교환 내역 ({classCards.length}건)</h3>
                {classCards.length === 0
                  ? <p className="text-sm">아직 명함 교환이 없습니다.</p>
                  : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr><th>수집자</th><th>→</th><th>명함 주인</th><th>피드백</th></tr>
                        </thead>
                        <tbody>
                          {classCards.map(c => (
                            <tr key={c.id}>
                              <td style={{ fontWeight: 600 }}>
                                {c.collectorStudentId?.split("_").slice(1).join("_")}
                              </td>
                              <td style={{ color: "#4361ee", fontWeight: 700 }}>→</td>
                              <td style={{ fontWeight: 600 }}>
                                {c.ownerName || c.ownerStudentId?.split("_").slice(1).join("_")}
                              </td>
                              <td>
                                {c.feedback
                                  ? <span title={c.feedback} style={{
                                      display: "inline-block", maxWidth: 200,
                                      overflow: "hidden", textOverflow: "ellipsis",
                                      whiteSpace: "nowrap", fontSize: "0.8rem", color: "#555"
                                    }}>💬 {c.feedback}</span>
                                  : <span style={{ color: "#ccc", fontSize: "0.8rem" }}>-</span>
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                }
              </>
            )}
          </div>
        )}

        {/* 피드백 내역 */}
        {tab === "feedbacks" && (
          <div>
            <p className="text-sm" style={{ marginBottom: 12 }}>
              전체 {feedbackCards.length}건의 피드백이 작성되었습니다.
            </p>
            {feedbackCards.length === 0
              ? <p className="text-sm">아직 작성된 피드백이 없습니다.</p>
              : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {feedbackCards.map(c => {
                    const cls = classes.find(cl => cl.id === c.classCode);
                    return (
                      <div key={c.id} style={{
                        border: "1.5px solid #e8f0fe", borderRadius: 10,
                        padding: "12px 14px", background: "#f8f9ff"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 4 }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                            <span style={{ color: "#4361ee" }}>
                              {c.collectorStudentId?.split("_").slice(1).join("_")}
                            </span>
                            <span style={{ color: "#aaa", margin: "0 6px" }}>→</span>
                            <span>{c.ownerName}</span>
                          </span>
                          <span className="text-sm">{cls?.name ?? c.classCode}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.88rem", color: "#333", lineHeight: 1.6 }}>
                          "{c.feedback}"
                        </p>
                      </div>
                    );
                  })}
                </div>
              )
            }
          </div>
        )}
      </div>
    </div>
  );
}
