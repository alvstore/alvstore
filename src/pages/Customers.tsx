import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Customers() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/crm", { replace: true }); }, [navigate]);
  return null;
}
