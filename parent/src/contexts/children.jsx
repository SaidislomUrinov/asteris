import { createContext, useContext, useMemo } from "react";
import { getChildren } from "../api/parent";
import { useRequest } from "../hooks/useRequest";

// /parent/children — butun daraxt bitta so'rovda; Home, Child va Group
// sahifalari shu keshdan o'qiydi (har sahifa qayta so'ramaydi).
const Ctx = createContext(null);

export const ChildrenProvider = ({ children }) => {
  const req = useRequest(getChildren, []);
  const value = useMemo(() => {
    const list = req.data || [];
    const findChild = (sid) => list.find((c) => c.student._id === sid) || null;
    const findEntry = (eid) => {
      for (const c of list)
        for (const ce of c.centers)
          for (const g of ce.groups || [])
            if (g.entryId === eid) return { child: c, center: ce, group: g };
      return null;
    };
    return { ...req, list, findChild, findEntry };
  }, [req]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useChildren = () => useContext(Ctx);
