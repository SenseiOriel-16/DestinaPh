/**
 * Inline HTML for an embedded map preview: satellite-style imagery (Esri World Imagery)
 * with a marker at the destination. No API keys. Leaflet from CDN.
 */
export function buildSatelliteMapPreviewHtml(latitude: number, longitude: number, title: string): string {
  const safeTitle = title.replace(/</g, "&lt;").replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" crossorigin="anonymous"/>
<style>html,body,#m{height:100%;margin:0;padding:0;background:#1a1a1a;} .attr{position:absolute;bottom:2px;left:4px;right:4px;font-size:8px;line-height:1.2;color:rgba(255,255,255,0.85);text-shadow:0 0 3px #000;pointer-events:none;z-index:1000;}</style>
</head><body>
<div id="m"></div>
<div class="attr">Satellite: Esri · Map: Leaflet · ${safeTitle}</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js" crossorigin="anonymous"></script>
<script>
(function(){
  var lat = ${latitude}, lng = ${longitude};
  var map = L.map('m', { zoomControl: true, attributionControl: false }).setView([lat, lng], 16);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    minZoom: 2
  }).addTo(map);
  L.marker([lat, lng]).addTo(map);
})();
</script>
</body></html>`;
}
