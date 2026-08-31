export default async function handler(req, res) {
  const params = new URLSearchParams(req.query).toString();
  const response = await fetch(`https://open.neis.go.kr/hub/schoolInfo?${params}`);
  const data = await response.json();
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(data);
}
