import AdmZip from 'adm-zip';

export function getPptxSlideCount(buffer) {
  try {
    const zip = new AdmZip(buffer);
    const appXmlEntry = zip.getEntry('docProps/app.xml');
    
    if (!appXmlEntry) {
      return null;
    }

    const appXml = appXmlEntry.getData().toString('utf8');
    const match = appXml.match(/<Slides>(\d+)<\/Slides>/i);
    
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    
    return null;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('PPTX parse error:', error);
    }
    return null;
  }
}
