import { useEffect, useRef } from "react";
import * as d3 from "d3";

export default function NetworkGraph({ students, cards }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!students.length) return;
    const el = svgRef.current;
    const W = el.clientWidth || 500;
    const H = 420;

    d3.select(el).selectAll("*").remove();
    const svg = d3.select(el)
      .attr("width", W)
      .attr("height", H);

    // 화살표 마커
    svg.append("defs").append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 22)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#4361ee");

    const nodes = students.map(s => ({
      id: s.id,
      name: s.name,
      received: cards.filter(c => c.ownerStudentId === s.id).length,
      sent: cards.filter(c => c.collectorStudentId === s.id).length,
    }));

    const links = cards.map(c => ({
      source: c.collectorStudentId,
      target: c.ownerStudentId,
    }));

    const radiusScale = d3.scaleLinear()
      .domain([0, d3.max(nodes, d => d.received) || 1])
      .range([14, 30]);

    const colorScale = d3.scaleSequential()
      .domain([0, d3.max(nodes, d => d.received) || 1])
      .interpolator(d3.interpolateBlues);

    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(90))
      .force("charge", d3.forceManyBody().strength(-220))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collision", d3.forceCollide(35));

    const g = svg.append("g");

    svg.call(d3.zoom()
      .scaleExtent([0.4, 2.5])
      .on("zoom", e => g.attr("transform", e.transform)));

    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#4361ee")
      .attr("stroke-opacity", 0.5)
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrow)");

    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(d3.drag()
        .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on("end", (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

    node.append("circle")
      .attr("r", d => radiusScale(d.received))
      .attr("fill", d => d.received === 0 ? "#f0f1f7" : colorScale(d.received))
      .attr("stroke", d => d.received === 0 ? "#ccc" : "#4361ee")
      .attr("stroke-width", 2);

    function textColor(bgHex) {
      const c = d3.color(bgHex);
      if (!c) return "#222";
      const r = c.r / 255, g = c.g / 255, b = c.b / 255;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return lum > 0.35 ? "#222" : "#fff";
    }

    node.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", "11px")
      .attr("fill", d => {
        const bg = d.received === 0 ? "#f0f1f7" : colorScale(d.received);
        return textColor(bg);
      })
      .attr("font-weight", "700")
      .attr("pointer-events", "none")
      .text(d => d.name.length > 4 ? d.name.slice(0, 4) + ".." : d.name);

    node.append("title")
      .text(d => `${d.name}\n받은 명함: ${d.received}장\n수집한 명함: ${d.sent}장`);

    sim.on("tick", () => {
      link
        .attr("x1", d => d.source.x).attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    return () => sim.stop();
  }, [students, cards]);

  return (
    <div>
      <div style={{ display: "flex", gap: 16, fontSize: "0.8rem", color: "#666", marginBottom: 8, flexWrap: "wrap" }}>
        <span>⬤ 원이 클수록 많이 받은 명함</span>
        <span>→ 화살표 방향 = 명함 수집 방향</span>
        <span>🖱️ 드래그·휠 가능</span>
      </div>
      <svg ref={svgRef} style={{ width: "100%", height: 420, border: "1px solid #eee", borderRadius: 10, background: "#fafbff" }} />
    </div>
  );
}
