export const getBaseAppUrl = (req: any) => {
  const host = req.headers?.["x-forwarded-host"] || req.headers?.host || (req.get && req.get("host")) || "localhost:3000";
  const proto = req.headers?.["x-forwarded-proto"] || (req.secure ? "https" : "http");
  return `${proto}://${host}`;
};
