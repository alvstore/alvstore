import { useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";

export default function Customers() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/crm", { replace: true }); }, [navigate]);
  return null;
}
