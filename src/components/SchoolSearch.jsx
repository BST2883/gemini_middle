import { useState, useRef, useEffect } from "react";
import { searchSchools } from "../utils/searchSchool";

export default function SchoolSearch({ value, onChange }) {
  const [input, setInput] = useState(value || "");
  const [results, setResults] = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowDrop(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleInput(val) {
    setInput(val);
    onChange(""); // 직접 입력 시 선택값 초기화
    setShowDrop(false);
    clearTimeout(debounceRef.current);
    if (val.length < 2) { setResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const data = await searchSchools(val);
      setResults(data);
      setSearching(false);
      setShowDrop(data.length > 0);
    }, 350);
  }

  function select(school) {
    setInput(school.name);
    onChange(school.name);
    setResults([]);
    setShowDrop(false);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", marginBottom: 12 }}>
      <input
        placeholder="학교명 검색 (2글자 이상)"
        value={input}
        onChange={e => handleInput(e.target.value)}
        autoComplete="off"
        style={{ marginBottom: 0 }}
      />
      {searching && (
        <p style={{ fontSize: "0.8rem", color: "#aaa", marginTop: 4 }}>검색 중...</p>
      )}
      {!searching && input.length >= 2 && results.length === 0 && !showDrop && (
        <p style={{ fontSize: "0.8rem", color: "#aaa", marginTop: 4 }}>
          검색 결과 없음. 직접 입력하세요.
        </p>
      )}
      {value && (
        <p style={{ fontSize: "0.82rem", color: "#4361ee", marginTop: 4 }}>✅ {value}</p>
      )}
      {showDrop && results.length > 0 && (
        <ul style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          background: "#fff", border: "1.5px solid #4361ee", borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 200,
          margin: 0, padding: 0, listStyle: "none",
          maxHeight: 220, overflowY: "auto"
        }}>
          {results.map((s, i) => (
            <li key={i}
              onMouseDown={() => select(s)}
              style={{
                padding: "10px 14px", cursor: "pointer",
                borderBottom: i < results.length - 1 ? "1px solid #f0f1f7" : "none",
                background: "#fff"
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#f0f4ff"}
              onMouseLeave={e => e.currentTarget.style.background = "#fff"}
            >
              <span style={{ fontWeight: 600 }}>{s.name}</span>
              <span style={{ color: "#888", fontSize: "0.82rem", marginLeft: 8 }}>{s.location}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
