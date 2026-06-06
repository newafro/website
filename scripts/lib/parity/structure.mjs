// Semantic structure parity — landmark + count comparison, never DOM trees
// (Wix classnames are random and meaningless). Flags the mismatches a designer
// cares about: missing nav/footer, dropped sections, image-density gaps.

export function diffStructure(net, com) {
  const n = net.structure || {}, c = com.structure || {};
  const diffs = [];
  const flag = (cond, msg, severity) => { if (cond) diffs.push({ msg, severity }); };

  flag(n.hasNav && !c.hasNav, 'Nav present on .net but missing on .com', 'High');
  flag(n.hasFooter && !c.hasFooter, 'Footer present on .net but missing on .com', 'High');

  const secDrop = (n.sectionCount || 0) - (c.sectionCount || 0);
  flag(secDrop >= 2, `.com has ${secDrop} fewer sections than .net (${c.sectionCount} vs ${n.sectionCount})`, 'High');

  const imgDrop = (n.imageCount || 0) - (c.imageCount || 0);
  flag(imgDrop >= 3, `.com shows ${imgDrop} fewer images than .net (${c.imageCount} vs ${n.imageCount})`, 'Medium');

  flag((n.videoCount || 0) > (c.videoCount || 0), `.net has video (${n.videoCount}) that .com lacks (${c.videoCount})`, 'High');

  return {
    netStructure: n,
    comStructure: c,
    diffs,
    sectionDelta: secDrop,
    imageDelta: imgDrop,
  };
}
