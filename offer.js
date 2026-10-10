async function getDeals(title) {
  const r = await fetch(
    `https://www.cheapshark.com/api/1.0/deals?title=${encodeURIComponent(title)}&exact=0&onSale=1`
  );
  const deals = await r.json();
  return deals.map(d => ({
    storeID: d.storeID,            // map via /api/1.0/stores
    salePrice: d.salePrice,
    normalPrice: d.normalPrice,
    discount: Math.round(d.savings) + "%",
    link: `https://www.cheapshark.com/redirect?dealID=${d.dealID}`
  }));
}