import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc, getDoc, setDoc, collection,
  query, where, onSnapshot, getDocs, serverTimestamp, deleteDoc
} from "firebase/firestore";
import NetworkGraph from "../components/NetworkGraph";
import SchoolSearch from "../components/SchoolSearch";

function generateClassCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

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

export default function TeacherDashboard() {
  const nav = useNavigate();
  const [teacher, setTeacher] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [allCards, setAllCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSchool, setNewSchool] = useState("");
  const [newGrade, setNewGrade] = useState("1");
  const [newClassNum, setNewClassNum] = useState("");
  const [tab, setTab] = useState("list");
  const [showPw, setShowPw] = useState({});
  const [teacherRef, setTeacherRef] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { nav("/teacher"); return; }
      const snap = await getDoc(doc(db, "teachers", user.uid));
      if (snap.exists()) setTeacher({ uid: user.uid, ...snap.data() });
      setTeacherRef(user.uid);

      const q = query(collection(db, "classes"), where("teacherId", "==", user.uid));
      const classUnsub = onSnapshot(q, (qs) => {
        setClasses(qs.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      });
      return () => classUnsub();
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    const q = query(collection(db, "students"), where("classCode", "==", selectedClass));
    const unsub = onSnapshot(q, (qs) => {
      setStudents(qs.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [selectedClass]);

  useEffect(() => {
    if (!selectedClass) return;
    const q = query(collection(db, "cards"), where("classCode", "==", selectedClass));
    getDocs(q).then(qs => setAllCards(qs.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [selectedClass, students]);

  async function createClass() {
    if (!newClassNum.trim()) { alert("반을 입력해주세요."); return; }
    setCreating(true);
    let code = generateClassCode();
    let snap = await getDoc(doc(db, "classes", code));
    while (snap.exists()) {
      code = generateClassCode();
      snap = await getDoc(doc(db, "classes", code));
    }
    const name = `${newSchool || "학교미입력"} ${newGrade}학년 ${newClassNum.trim()}반`;
    await setDoc(doc(db, "classes", code), {
      teacherId: teacher.uid,
      name,
      school: newSchool || "",
      grade: newGrade,
      classNum: newClassNum.trim(),
      createdAt: serverTimestamp(),
      active: true,
    });
    setSelectedClass(code);
    setNewSchool("");
    setNewGrade("1");
    setNewClassNum("");
    setShowCreateForm(false);
    setCreating(false);
  }

  async function handleDeleteStudent(s) {
    if (!window.confirm(`"${s.name}" 학생을 삭제하시겠습니까?\n관련 명함 데이터도 함께 삭제됩니다.`)) return;
    const [q1, q2] = [
      query(collection(db, "cards"), where("collectorStudentId", "==", s.id)),
      query(collection(db, "cards"), where("ownerStudentId", "==", s.id))
    ];
    const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    await Promise.all([
      deleteDoc(doc(db, "students", s.id)),
      ...[...s1.docs, ...s2.docs].map(d => deleteDoc(d.ref))
    ]);
  }

  async function handleDeleteClass() {
    if (!selectedClass) return;
    const name = selectedClassData?.name || selectedClass;
    if (!window.confirm(`"${name}" 클래스를 삭제하시겠습니까?\n\n학생 ${students.length}명과 명함 데이터가 모두 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`)) return;
    const [sSnap, cSnap] = await Promise.all([
      getDocs(query(collection(db, "students"), where("classCode", "==", selectedClass))),
      getDocs(query(collection(db, "cards"), where("classCode", "==", selectedClass)))
    ]);
    await Promise.all([
      ...sSnap.docs.map(d => deleteDoc(d.ref)),
      ...cSnap.docs.map(d => deleteDoc(d.ref)),
      deleteDoc(doc(db, "classes", selectedClass))
    ]);
    setSelectedClass(null);
    setStudents([]);
    setAllCards([]);
  }

  function exportStudentsCSV() {
    const name = selectedClassData?.name || selectedClass;
    const headers = ["이름", "클래스", "명함 등록", "수집 수", "받은 수", "받은 피드백 수", "비밀번호"];
    const rows = students.map(s => {
      const received = allCards.filter(c => c.ownerStudentId === s.id).length;
      const fbCount = allCards.filter(c => c.ownerStudentId === s.id && c.feedback).length;
      return [s.name, name, s.slideUrl ? "완료" : "미완료", s.cardCount ?? 0, received, fbCount, s.passwordPlain ?? "재로그인 후 표시"];
    });
    downloadCSV(`${name}_학생목록.csv`, headers, rows);
  }

  function exportFeedbackCSV() {
    const name = selectedClassData?.name || selectedClass;
    const headers = ["수집자", "명함 주인", "피드백 내용", "작성 시간"];
    const rows = allCards.filter(c => c.feedback).map(c => [
      c.collectorStudentId?.split("_").slice(1).join("_"),
      c.ownerName,
      c.feedback,
      c.feedbackAt?.toDate?.()?.toLocaleString("ko-KR") ?? ""
    ]);
    downloadCSV(`${name}_피드백.csv`, headers, rows);
  }

  async function handleLogout() {
    await signOut(auth);
    nav("/teacher");
  }

  const selectedClassData = classes.find(c => c.id === selectedClass);
  const registeredCount = students.filter(s => s.slideUrl).length;
  const avgCards = students.length ? (students.reduce((a, s) => a + (s.cardCount ?? 0), 0) / students.length).toFixed(1) : 0;
  const feedbackWritten = allCards.filter(c => c.feedback).length;
  const feedbackRate = allCards.length ? Math.round(feedbackWritten / allCards.length * 100) : 0;

  return (
    <div className="page" style={{ justifyContent: "flex-start", paddingTop: 32 }}>
      <div className="card" style={{ maxWidth: 600 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>교사 대시보드</h2>
          <button className="btn btn-secondary"
            style={{ width: "auto", padding: "6px 14px", fontSize: "0.8rem" }}
            onClick={handleLogout}>로그아웃</button>
        </div>
        {teacher && <p className="text-sm">{teacher.name} ({teacher.email})</p>}

        <div className="mt">
          {!showCreateForm
            ? <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>+ 새 클래스 생성</button>
            : (
              <div style={{ background: "#f0f4ff", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                <label>학교 검색</label>
                <SchoolSearch value={newSchool} onChange={setNewSchool} />
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label>학년</label>
                    <select value={newGrade} onChange={e => setNewGrade(e.target.value)}
                      style={{ width: "100%", padding: "12px 14px", border: "1.5px solid #dde1f0", borderRadius: 8, fontSize: "0.95rem", marginBottom: 12 }}>
                      <option value="1">1학년</option>
                      <option value="2">2학년</option>
                      <option value="3">3학년</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>반</label>
                    <input type="number" placeholder="예: 3" value={newClassNum}
                      onChange={e => setNewClassNum(e.target.value)} min="1" max="30" />
                  </div>
                </div>
                <div className="flex-row">
                  <button className="btn btn-primary" onClick={createClass} disabled={creating || !newClassNum.trim()}>
                    {creating ? "생성 중..." : "생성하기"}
                  </button>
                  <button className="btn btn-secondary" onClick={() => setShowCreateForm(false)}>취소</button>
                </div>
              </div>
            )
          }
        </div>

        {classes.length > 0 && (
          <div className="mt">
            <p className="text-sm" style={{ marginBottom: 8 }}>클래스 선택</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {classes.map(c => (
                <button key={c.id}
                  className={`btn ${selectedClass === c.id ? "btn-primary" : "btn-secondary"}`}
                  style={{ width: "auto", padding: "8px 16px", fontSize: "0.85rem" }}
                  onClick={() => { setSelectedClass(c.id); setTab("list"); }}>
                  {c.name || c.id}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedClass && selectedClassData && (
          <>
            {/* 클래스 정보 + 삭제 */}
            <div style={{ background: "#f0f4ff", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p className="text-sm">학생들에게 이 코드를 공유하세요</p>
                  <p style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "0.15em", color: "#4361ee", margin: "4px 0" }}>
                    {selectedClass}
                  </p>
                  <p style={{ fontSize: "0.9rem", color: "#555" }}>
                    {selectedClassData.school && <span>{selectedClassData.school} · </span>}
                    {selectedClassData.grade}학년 {selectedClassData.classNum}반
                  </p>
                </div>
                <button
                  onClick={handleDeleteClass}
                  style={{
                    background: "none", border: "1.5px solid #e63946", color: "#e63946",
                    borderRadius: 8, padding: "6px 12px", fontSize: "0.78rem", cursor: "pointer"
                  }}>
                  🗑️ 클래스 삭제
                </button>
              </div>
            </div>

            {/* 활동 현황 요약 (학생이 있을 때만) */}
            {students.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
                {[
                  { label: "명함 등록률", value: `${Math.round(registeredCount / students.length * 100)}%`, sub: `${registeredCount}/${students.length}명`, color: "#06d6a0" },
                  { label: "평균 수집", value: `${avgCards}장`, sub: `총 ${allCards.length}건`, color: "#4361ee" },
                  { label: "피드백 작성률", value: `${feedbackRate}%`, sub: `${feedbackWritten}/${allCards.length}건`, color: "#8338ec" },
                ].map(s => (
                  <div key={s.label} style={{
                    background: s.color + "12", border: `1.5px solid ${s.color}33`,
                    borderRadius: 10, padding: "10px 8px", textAlign: "center"
                  }}>
                    <div style={{ fontSize: "1.3rem", fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: "0.72rem", color: "#666", marginTop: 2 }}>{s.label}</div>
                    <div style={{ fontSize: "0.7rem", color: "#aaa" }}>{s.sub}</div>
                  </div>
                ))}
              </div>
            )}

            {/* 탭 */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[
                { key: "list", label: "학생 목록" },
                { key: "feedback", label: "피드백 현황" },
                { key: "graph", label: "관계 그래프" },
              ].map(t => (
                <button key={t.key}
                  className={`btn ${tab === t.key ? "btn-primary" : "btn-secondary"}`}
                  style={{ flex: 1 }} onClick={() => setTab(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* 학생 목록 탭 */}
            {tab === "list" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h2 style={{ margin: 0 }}>학생 현황 ({students.length}명)</h2>
                  {students.length > 0 && (
                    <button
                      className="btn btn-secondary"
                      style={{ width: "auto", padding: "6px 12px", fontSize: "0.78rem" }}
                      onClick={exportStudentsCSV}>
                      📥 CSV 내보내기
                    </button>
                  )}
                </div>
                {students.length === 0
                  ? <p className="text-sm">아직 입장한 학생이 없습니다.</p>
                  : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr><th>이름</th><th>명함</th><th>수집</th><th>받음</th><th>비밀번호</th><th></th></tr>
                        </thead>
                        <tbody>
                          {students.map(s => {
                            const received = allCards.filter(c => c.ownerStudentId === s.id).length;
                            return (
                              <tr key={s.id}>
                                <td style={{ fontWeight: 600 }}>
                                  {s.slideUrl
                                    ? <a href={s.slideUrl} target="_blank" rel="noreferrer" style={{ color: "#4361ee" }}>{s.name}</a>
                                    : s.name
                                  }
                                </td>
                                <td>
                                  {s.slideUrl
                                    ? <span className="tag">완료</span>
                                    : <span style={{ color: "#e63946", fontSize: "0.8rem" }}>미등록</span>
                                  }
                                </td>
                                <td>{s.cardCount ?? 0}장</td>
                                <td>{received}장</td>
                                <td>
                                  {showPw[s.id]
                                    ? <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
                                        {s.passwordPlain ?? "재로그인 후 표시"}
                                      </span>
                                    : <button
                                        style={{ background: "none", border: "1px solid #dde1f0", borderRadius: 6, padding: "2px 10px", cursor: "pointer", fontSize: "0.8rem" }}
                                        onClick={() => setShowPw(p => ({ ...p, [s.id]: true }))}>
                                        확인
                                      </button>
                                  }
                                </td>
                                <td>
                                  <button
                                    onClick={() => handleDeleteStudent(s)}
                                    style={{ background: "none", border: "none", color: "#e63946", cursor: "pointer", fontSize: "1rem", padding: "2px 4px" }}
                                    title="학생 삭제">🗑️</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                }
                <p className="text-sm mt" style={{ color: "#aaa" }}>
                  * 이름 클릭 시 해당 학생의 명함을 바로 볼 수 있습니다.<br />
                  * 기존 학생은 재로그인하면 비밀번호가 저장됩니다.
                </p>
              </>
            )}

            {/* 피드백 현황 탭 */}
            {tab === "feedback" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h2 style={{ margin: 0 }}>피드백 현황</h2>
                  {allCards.filter(c => c.feedback).length > 0 && (
                    <button
                      className="btn btn-secondary"
                      style={{ width: "auto", padding: "6px 12px", fontSize: "0.78rem" }}
                      onClick={exportFeedbackCSV}>
                      📥 피드백 CSV
                    </button>
                  )}
                </div>
                {students.length === 0
                  ? <p className="text-sm">학생이 없습니다.</p>
                  : students.map(s => {
                    const received = allCards.filter(c => c.ownerStudentId === s.id && c.feedback);
                    return (
                      <div key={s.id} style={{
                        border: "1.5px solid #e8eaf6", borderRadius: 10,
                        padding: "12px 14px", marginBottom: 12
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontWeight: 700 }}>{s.name}</span>
                          <span className="text-sm">
                            {received.length > 0
                              ? <span style={{ color: "#4361ee" }}>피드백 {received.length}건</span>
                              : <span style={{ color: "#aaa" }}>피드백 없음</span>
                            }
                          </span>
                        </div>
                        {received.length === 0
                          ? <p className="text-sm" style={{ color: "#ccc", margin: 0 }}>아직 받은 피드백이 없습니다.</p>
                          : received.map(c => (
                            <div key={c.id} style={{
                              background: "#f8f9ff", borderRadius: 6, padding: "8px 10px",
                              marginBottom: 6, fontSize: "0.85rem"
                            }}>
                              <span style={{ color: "#4361ee", fontWeight: 600, marginRight: 6 }}>
                                {c.collectorStudentId?.split("_").slice(1).join("_")}
                              </span>
                              <span style={{ color: "#555" }}>{c.feedback}</span>
                            </div>
                          ))
                        }
                      </div>
                    );
                  })
                }
              </>
            )}

            {/* 관계 그래프 탭 */}
            {tab === "graph" && (
              <>
                <h2>명함 교환 관계도</h2>
                {students.length < 2
                  ? <p className="text-sm">학생이 2명 이상이어야 그래프가 표시됩니다.</p>
                  : <NetworkGraph students={students} cards={allCards} />
                }
                <p className="text-sm mt">원이 작거나 연한 학생에게 피드백을 주세요.</p>
              </>
            )}
          </>
        )}

        {!loading && classes.length === 0 && (
          <p className="text-sm mt">아직 클래스가 없습니다. "새 클래스 생성"을 눌러 시작하세요.</p>
        )}
      </div>
    </div>
  );
}
