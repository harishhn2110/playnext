async function getGameDetails(id) {
  const g = await fetch(`/api/games/${id}`).then(r => r.json());
  return {
    title: g.name,
    poster: g.background_image,
    description: g.description_raw,
    developer: g.developers?.map(d => d.name).join(", "),
    publisher: g.publishers?.map(p => p.name).join(", "),
    metacritic: g.metacritic,
    stores: g.stores?.map(s => ({ name: s.store.name, url: s.url })) // direct store links
  };
}