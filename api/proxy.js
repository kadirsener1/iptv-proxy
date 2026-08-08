const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // CORS ayarları
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(200).send("Kullanım: /api/proxy?url=https://link.com/kanal.m3u8");
  }

  try {
    const destUrl = new URL(targetUrl);
    
    const response = await fetch(destUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': destUrl.origin + '/',
        'Origin': destUrl.origin
      }
    });

    const contentType = response.headers.get('content-type');

    // Eğer playlist dosyasıysa (m3u8)
    if (targetUrl.includes('.m3u8') || (contentType && contentType.includes('mpegurl'))) {
      let body = await response.text();
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['host'];
      const baseProxyUrl = `${protocol}://${host}/api/proxy?url=`;

      const targetBaseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

      // Linkleri proxy üzerinden geçecek şekilde düzenle
      const lines = body.split('\n');
      const rewrittenBody = lines.map(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return line;
        
        let fullPath;
        if (line.startsWith('http')) {
          fullPath = line;
        } else {
          fullPath = targetBaseUrl + line;
        }
        return baseProxyUrl + encodeURIComponent(fullPath);
      }).join('\n');

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.send(rewrittenBody);
    }

    // Video parçaları (.ts) için
    response.body.pipe(res);

  } catch (error) {
    res.status(500).send("Proxy Hatası: " + error.message);
  }
};
