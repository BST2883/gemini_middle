export async function searchSchools(keyword) {
  if (!keyword || keyword.length < 2) return [];

  const params = new URLSearchParams({
    Type: "json",
    pIndex: 1,
    pSize: 15,
    SCHUL_KND_SC_NM: "중학교",
    SCHUL_NM: keyword,
  });

  // Vite 프록시를 통해 CORS 없이 NEIS API 호출
  try {
    const res = await fetch(`/api/neis?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rows = data?.schoolInfo?.[1]?.row;
    if (!rows) return [];
    return rows.map(r => ({
      name: r.SCHUL_NM,
      location: r.LCTN_SC_NM,
    }));
  } catch (e) {
    console.error("NEIS API 오류:", e);
    return [];
  }
}
