import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "./AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useContext(AuthContext);
  
  if (loading) {
    return <div>Loading...</div>; // You can replace this with a proper loading spinner
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />; 
  }
  
  return children; 
}
