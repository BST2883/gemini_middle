import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import {
  doc, getDoc, updateDoc, collection,
  addDoc, query, where, getDocs, serverTimestamp
} from "firebase/firestore";
import QRCode from "qrcode";
import { Html5Qrcode } from "html5-qrcode";

const APP_BASE = window.location.origin;

function toEmbedUrl(url) {
  return url.replace(/\/edit.*$/, "/embed").replace(/\/pub.*$/, "/embed");
}

export default function StudentHome() {
  const nav = useNavigate();
  const studentId = sessionStorage.getItem("studentId");
  const studentName = sessionStorage.getItem("studentName");

  const [student, setStudent] = useState(null);
  const [slideUrl, setSlideUrl] = useState("");
  const [slideInput, setSlideInput] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [cards, setCards] = useState([]);
  const [receivedFeedbacks, setReceivedFeedbacks] = useState([]);
  const [classRank, setClassRank] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showShareQr, setShowShareQr] = useState(false);
  const [showMySlide, setShowMySlide] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("collected");
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!studentId) { nav("/student"); return; }
    loadStudent();
  }, []);

  async function loadStudent() {
    const snap = await getDoc(doc(db, "students", studentId));
    if (!snap.exists()) { nav("/student"); return; }
    const data = snap.data();
    setStudent(data);
    if (data.slideUrl) {
      setSlideUrl(data.slideUrl);
      generateQr(studentId);
    } else {
      setShowRegister(true);
    }
    loadCards();
    loadReceivedFeedbacks();
    loadClassRank(data.classCode, data.cardCount ?? 0);
  }

  async function loadCards() {
    const q = query(collection(db, "cards"), where("collectorStudentId", "==", studentId));
    const snap = await getDocs(q);
    setCards(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function loadReceivedFeedbacks() {
    const q = query(collection(db, "cards"), where("ownerStudentId", "==", studentId));
    const snap = await getDocs(q);
    setReceivedFeedbacks(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.feedback));
  }

  async function loadClassRank(classCode, myCardCount) {
    if (!classCode) return;
    const q = query(collection(db, "students"), where("classCode", "==", classCode));
    const snap = await getDocs(q);
    const counts = snap.docs.map(d => d.data().cardCount ?? 0).sort((a, b) => b - a);
    const rank = counts.filter(c => c > myCardCount).length + 1;
    setClassRank({ rank, total: counts.length });
  }

  async function generateQr(sid) {
    const url = `${APP_BASE}/card/${sid}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 240, margin: 1 });
    setQrDataUrl(dataUrl);
  }

  async function handleRegister() {
    if (!slideInput.trim().includes("docs.google.com/presentation")) {
      showToast("구글 슬라이드 링크를 입력해주세요.");
      return;
    }
    setLoading(true);
    await updateDoc(doc(db, "students", studentId), {
      slideUrl: slideInput.trim(),
      slideTitle: studentName + "의 명함",
      qrRegisteredAt: serverTimestamp(),
    });
    setSlideUrl(slideInput.trim());
    await generateQr(studentId);
    setShowRegister(false);
    setLoading(false);
    showToast("명함이 등록되었습니다!");
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  }

  async function startScanner() {
    if (!slideUrl) {
      showToast("먼저 내 명함을 등록해야 스캔할 수 있습니다.");
      return;
    }
    setShowScanner(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("qr-reader");
        scannerRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 220 },
          async (decodedText) => {
            await html5QrCode.stop();
            setShowScanner(false);
            handleScanned(decodedText);
          }
        );
      } catch {
        showToast("카메라 접근 권한을 허용해주세요.");
        setShowScanner(false);
      }
    }, 100);
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
    setShowScanner(false);
  }

  async function handleScanned(url) {
    const match = url.match(/\/card\/([^/?#]+)/);
    if (!match) { showToast("올바른 명함 QR이 아닙니다."); return; }
    const ownerId = match[1];
    if (ownerId === studentId) { showToast("본인의 QR은 등록할 수 없습니다."); return; }

    const ownerSnap = await getDoc(doc(db, "students", ownerId));
    if (!ownerSnap.exists()) { showToast("존재하지 않는 학생입니다."); return; }
    const owner = ownerSnap.data();

    const q = query(
      collection(db, "cards"),
      where("collectorStudentId", "==", studentId),
      where("ownerStudentId", "==", ownerId)
    );
    const existing = await getDocs(q);
    if (!existing.empty) { showToast(`${owner.name}님의 명함은 이미 있습니다.`); return; }

    const newCount = cards.length + 1;
    await addDoc(collection(db, "cards"), {
      collectorStudentId: studentId,
      ownerStudentId: ownerId,
      ownerName: owner.name,
      classCode: owner.classCode,
      slideUrl: owner.slideUrl,
      slideTitle: owner.slideTitle || owner.name + "의 명함",
      feedback: "",
      feedbackAt: null,
      collectedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "students", studentId), { cardCount: newCount });
    showToast(`${owner.name}님의 명함을 저장했습니다! 피드백도 남겨보세요 💬`);
    loadCards();
    if (student?.classCode) loadClassRank(student.classCode, newCount);
  }

  function openFeedback(card) {
    setFeedbackTarget({ cardId: card.id, ownerName: card.ownerName, existingText: card.feedback || "" });
    setFeedbackText(card.feedback || "");
  }

  async function saveFeedback() {
    if (!feedbackText.trim()) { showToast("피드백 내용을 입력해주세요."); return; }
    setLoading(true);
    await updateDoc(doc(db, "cards", feedbackTarget.cardId), {
      feedback: feedbackText.trim(),
      feedbackAt: serverTimestamp(),
    });
    setFeedbackTarget(null);
    setFeedbackText("");
    showToast("피드백을 저장했습니다!");
    loadCards();
    loadReceivedFeedbacks();
    setLoading(false);
  }

  function downloadQr() {
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${studentName}_명함QR.png`;
    a.click();
  }

  const writtenFeedbacks = cards.filter(c => c.feedback);

  return (
    <div className="page" style={{ justifyContent: "flex-start", paddingTop: 32 }}>
      <div className="card" style={{ maxWidth: 480 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0 }}>안녕하세요, {studentName}님!</h2>
            {classRank && (
              <p className="text-sm" style={{ marginTop: 4, color: "#4361ee" }}>
                🏅 반 명함 수집 {classRank.rank}위 / {classRank.total}명
              </p>
            )}
          </div>
          <button className="btn btn-secondary"
            style={{ width: "auto", padding: "6px 14px", fontSize: "0.8rem" }}
            onClick={() => { sessionStorage.clear(); nav("/"); }}>로그아웃</button>
        </div>

        {/* 안내 메시지 */}
        <div style={{
          background: "linear-gradient(135deg, #4361ee15, #8338ec15)",
          border: "1.5px solid #4361ee33",
          borderRadius: 10, padding: "12px 14px", margin: "14px 0 4px",
          fontSize: "0.88rem", lineHeight: 1.7, color: "#333"
        }}>
          <span style={{ fontWeight: 700, color: "#4361ee" }}>💡 잠깐!</span>{" "}
          명함만 주고받지 마세요! 오늘 여러분은 <strong>그 직업의 전문가</strong>입니다.
          자신 있게 나를 소개하고, 상대방의 꿈에도 <strong>진심으로 반응</strong>해 보세요.
        </div>

        {slideUrl && (
          <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowMySlide(true)}>
              🪪 내 명함 보기
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowShareQr(true)}>
              📤 명함 공유하기
            </button>
          </div>
        )}
        {slideUrl && (
          <button className="btn btn-secondary" onClick={() => setShowRegister(true)}>
            ✏️ 내 명함 링크 수정
          </button>
        )}
        <div className="gap" />
        <button
          className={`btn ${slideUrl ? "btn-success" : "btn-secondary"}`}
          onClick={startScanner}
          title={!slideUrl ? "명함을 먼저 등록해야 스캔할 수 있습니다" : ""}
        >
          📷 명함 보관하기 (QR 스캔)
          {!slideUrl && <span style={{ fontSize: "0.75rem", display: "block", opacity: 0.7 }}>명함 등록 후 사용 가능</span>}
        </button>

        {/* 탭 */}
        <div style={{ display: "flex", gap: 5, marginTop: 24, marginBottom: 4 }}>
          {[
            { key: "collected", label: `수집 (${cards.length})` },
            { key: "received", label: `받은 피드백 (${receivedFeedbacks.length})`, badge: receivedFeedbacks.length },
            { key: "written", label: `쓴 피드백 (${writtenFeedbacks.length})` },
          ].map(t => (
            <button key={t.key}
              className={`btn ${tab === t.key ? "btn-primary" : "btn-secondary"}`}
              style={{ flex: 1, padding: "9px 4px", fontSize: "0.77rem", position: "relative" }}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {t.key === "received" && t.badge > 0 && (
                <span style={{
                  position: "absolute", top: -6, right: -4,
                  background: "#e63946", color: "#fff",
                  borderRadius: "50%", width: 18, height: 18,
                  fontSize: "0.65rem", fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* 수집한 명함 탭 */}
        {tab === "collected" && (
          <div style={{ marginTop: 8 }}>
            {cards.length === 0
              ? <p className="text-sm">아직 수집한 명함이 없습니다.</p>
              : cards.map(c => (
                <div key={c.id} style={{
                  border: "1px solid #eee", borderRadius: 10, padding: "12px 14px",
                  marginBottom: 10, background: "#fafbff"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600 }}>{c.ownerName}</span>
                    <span className="text-sm">
                      {c.collectedAt?.toDate
                        ? c.collectedAt.toDate().toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                        : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <a href={c.slideUrl} target="_blank" rel="noreferrer" style={{ flex: 1, textDecoration: "none" }}>
                      <button className="btn btn-secondary" style={{ padding: "7px", fontSize: "0.82rem", width: "100%" }}>
                        📄 명함 보기
                      </button>
                    </a>
                    <button
                      className={`btn ${c.feedback ? "btn-secondary" : "btn-primary"}`}
                      style={{ flex: 1, padding: "7px", fontSize: "0.82rem" }}
                      onClick={() => openFeedback(c)}
                    >
                      {c.feedback ? "💬 수정" : "💬 피드백 남기기"}
                    </button>
                  </div>
                  {c.feedback && (
                    <p style={{
                      marginTop: 8, fontSize: "0.82rem", color: "#555",
                      background: "#f0f4ff", borderRadius: 6, padding: "8px 10px", lineHeight: 1.5
                    }}>"{c.feedback}"</p>
                  )}
                </div>
              ))
            }
          </div>
        )}

        {/* 받은 피드백 탭 */}
        {tab === "received" && (
          <div style={{ marginTop: 8 }}>
            {receivedFeedbacks.length === 0
              ? <p className="text-sm">아직 받은 피드백이 없습니다.<br />친구들이 피드백을 남기면 여기에 나타납니다.</p>
              : receivedFeedbacks.map(c => (
                <div key={c.id} style={{
                  border: "1px solid #e8f0fe", borderRadius: 10, padding: "14px",
                  marginBottom: 10, background: "#f8f9ff"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: "#4361ee" }}>
                      {c.collectorStudentId?.split("_").slice(1).join("_")}님의 피드백
                    </span>
                    <span className="text-sm">
                      {c.feedbackAt?.toDate
                        ? c.feedbackAt.toDate().toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                        : ""}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.9rem", color: "#333", lineHeight: 1.6, margin: 0 }}>"{c.feedback}"</p>
                </div>
              ))
            }
          </div>
        )}

        {/* 내가 쓴 피드백 탭 */}
        {tab === "written" && (
          <div style={{ marginTop: 8 }}>
            {writtenFeedbacks.length === 0
              ? <p className="text-sm">아직 작성한 피드백이 없습니다.<br />"수집" 탭에서 피드백을 남겨보세요.</p>
              : writtenFeedbacks.map(c => (
                <div key={c.id} style={{
                  border: "1px solid #fde8b0", borderRadius: 10, padding: "14px",
                  marginBottom: 10, background: "#fffbf0"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
                    <span style={{ fontWeight: 600 }}>→ {c.ownerName}님에게</span>
                    <button
                      className="btn btn-secondary"
                      style={{ width: "auto", padding: "3px 10px", fontSize: "0.75rem" }}
                      onClick={() => { setTab("collected"); openFeedback(c); }}
                    >수정</button>
                  </div>
                  <p style={{ fontSize: "0.88rem", color: "#555", lineHeight: 1.6, margin: 0 }}>"{c.feedback}"</p>
                  <p className="text-sm" style={{ marginTop: 6, color: "#aaa" }}>
                    {c.feedbackAt?.toDate
                      ? c.feedbackAt.toDate().toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                      : ""}
                  </p>
                </div>
              ))
            }
          </div>
        )}
      </div>

      {/* 내 명함 보기 모달 */}
      {showMySlide && (
        <div className="modal-overlay" onClick={() => setShowMySlide(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 16, padding: "20px 16px 16px",
            width: "96vw", maxWidth: 900, maxHeight: "92vh",
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>{studentName}님의 명함</h2>
              <button onClick={() => setShowMySlide(false)}
                style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ width: "100%", aspectRatio: "16/9", borderRadius: 8, overflow: "hidden", border: "1px solid #eee", minHeight: 200 }}>
              <iframe src={toEmbedUrl(slideUrl)} allowFullScreen title="내 명함"
                style={{ width: "100%", height: "100%", border: "none" }} />
            </div>
            <a href={slideUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              <button className="btn btn-secondary">슬라이드 원본 열기</button>
            </a>
          </div>
        </div>
      )}

      {/* 명함 공유하기 모달 */}
      {showShareQr && (
        <div className="modal-overlay" onClick={() => setShowShareQr(false)}>
          <div className="modal text-center" onClick={e => e.stopPropagation()}>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>{studentName}님의 명함 QR</p>
            <p className="text-sm" style={{ marginBottom: 16 }}>친구에게 이 QR을 보여주세요</p>
            <img src={qrDataUrl} alt="QR" style={{ width: "100%", maxWidth: 260 }} />
            <div className="gap" />
            <button className="btn btn-secondary" onClick={downloadQr}>다운로드</button>
            <button className="btn btn-secondary" onClick={() => setShowShareQr(false)}>닫기</button>
          </div>
        </div>
      )}

      {/* 명함 등록/수정 모달 */}
      {showRegister && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>내 명함 등록</h2>
            <div className="notice">
              반드시 슬라이드 공유 권한을 <strong>"링크가 있는 모든 사용자 - 뷰어"</strong>로 설정해주세요.
            </div>
            <label>구글 슬라이드 링크</label>
            <input placeholder="https://docs.google.com/presentation/d/..."
              value={slideInput} onChange={e => setSlideInput(e.target.value)} />
            {slideInput && slideInput.includes("docs.google.com/presentation") && (
              <div className="iframe-wrap">
                <iframe src={toEmbedUrl(slideInput)} allowFullScreen title="미리보기" />
              </div>
            )}
            <div className="flex-row">
              <button className="btn btn-primary" onClick={handleRegister} disabled={loading}>
                {loading ? "등록 중..." : "등록 완료"}
              </button>
              {student?.slideUrl && (
                <button className="btn btn-secondary" onClick={() => setShowRegister(false)}>취소</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR 스캔 모달 */}
      {showScanner && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>QR 스캔</h2>
            <p className="text-sm">친구의 화면에 있는 QR 코드를 비춰주세요.</p>
            <div id="qr-reader" style={{ width: "100%", borderRadius: 8, overflow: "hidden" }} />
            <div className="gap" />
            <button className="btn btn-secondary" onClick={stopScanner}>취소</button>
          </div>
        </div>
      )}

      {/* 피드백 작성 모달 */}
      {feedbackTarget && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>💬 {feedbackTarget.ownerName}님께 피드백</h2>
            <p className="text-sm" style={{ marginBottom: 12 }}>
              상대방의 명함(진로)을 보고 느낀 점을 진심으로 써주세요.
            </p>
            <textarea
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value.slice(0, 300))}
              placeholder={`예시)\n"○○ 직업에 대해 처음 알게 되었는데, 전문성이 느껴져서 멋있었습니다. 앞으로 해당 분야를 이끄는 리더가 되시길 응원합니다!"`}
              rows={6}
              style={{
                width: "100%", border: "1.5px solid #dde1f0", borderRadius: 8,
                padding: "12px", fontSize: "0.92rem", resize: "vertical",
                lineHeight: 1.6, marginBottom: 4, outline: "none", fontFamily: "inherit"
              }}
            />
            <p className="text-sm" style={{
              textAlign: "right", marginBottom: 12,
              color: feedbackText.length >= 280 ? "#e63946" : "#aaa"
            }}>
              {feedbackText.length} / 300자
            </p>
            <div className="flex-row">
              <button className="btn btn-primary" onClick={saveFeedback} disabled={loading || !feedbackText.trim()}>
                {loading ? "저장 중..." : "피드백 저장"}
              </button>
              <button className="btn btn-secondary" onClick={() => { setFeedbackTarget(null); setFeedbackText(""); }}>취소</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
