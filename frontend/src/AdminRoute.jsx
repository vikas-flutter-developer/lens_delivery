import { useContext } from "react";
import { AuthContext } from "./AuthContext";
import NotFound from "./Pages/NotFound"; // your 404 page

export const AdminRoute = ({ allowedRoles = ["admin"], children }) => {
  const { user } = useContext(AuthContext);

  if (user === undefined) return null; // optional: can show a spinner
  if (!user || !allowedRoles.includes(user.role)) {
    return <NotFound />;
  }

  return children;
};