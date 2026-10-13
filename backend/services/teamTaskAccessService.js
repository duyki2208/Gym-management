const ALL_TEAMS = Object.freeze(["sale", "pt", "reception"]);

const TEAM_BY_ROLE = Object.freeze({
  sm: "sale",
  sale: "sale",
  pm: "pt",
  pt: "pt",
  om: "reception",
  reception: "reception",
});

const ALL_TEAM_ROLES = new Set(["admin", "accountant", "manager"]);

const getVisibleTeams = (role) => {
  if (ALL_TEAM_ROLES.has(role)) return [...ALL_TEAMS];
  return TEAM_BY_ROLE[role] ? [TEAM_BY_ROLE[role]] : [];
};

const resolveRequestedTeam = (role, requestedTeam) => {
  const visibleTeams = getVisibleTeams(role);
  if (visibleTeams.length === 1) return visibleTeams[0];
  return visibleTeams.includes(requestedTeam) ? requestedTeam : null;
};

const canAccessTeam = (role, team) => getVisibleTeams(role).includes(team);

module.exports = {
  ALL_TEAMS,
  getVisibleTeams,
  resolveRequestedTeam,
  canAccessTeam,
};
