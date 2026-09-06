// Shared visibility rules for Official Documents, used by the admin routes,
// the public routes, and the file-streaming endpoints so they can never drift.
//
//   PUBLIC        — anyone, including logged-out website visitors
//   DISTRICT_ONLY — members + admins of that document's district, and State admins
//   STATE_ONLY    — State Committee only

// Prisma `where` filter for the list a given auth context is allowed to see.
// `auth` is req.auth (or null / undefined for anonymous).
function documentListWhere(auth) {
  if (!auth) return { visibility: "PUBLIC" };
  if (auth.role === "STATE_ADMIN") return {};
  const or = [{ visibility: "PUBLIC" }];
  if (auth.districtId) or.push({ visibility: "DISTRICT_ONLY", districtId: auth.districtId });
  return { OR: or };
}

// Per-document read check (used before streaming the file).
function canReadDocument(doc, auth) {
  if (!doc) return false;
  if (doc.visibility === "PUBLIC") return true;
  if (!auth) return false;
  if (auth.role === "STATE_ADMIN") return true;
  if (doc.visibility === "DISTRICT_ONLY") return !!doc.districtId && doc.districtId === auth.districtId;
  return false; // STATE_ONLY and everything else
}

// Who may edit/delete a document.
function canManageDocument(doc, auth) {
  if (!doc || !auth) return false;
  if (auth.role === "STATE_ADMIN") return true;
  if (auth.role === "DISTRICT_ADMIN") return !!doc.districtId && doc.districtId === auth.districtId;
  return false;
}

module.exports = { documentListWhere, canReadDocument, canManageDocument };
