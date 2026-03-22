'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '../components/AuthProvider';
import { supabase } from '../lib/supabase';
import type { TeamRole } from '../types';

interface RoleContextType {
  role: TeamRole;
  isOwner: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** For team members: the landlord_id whose data they should load. null = own account. */
  ownerId: string | null;
  loading: boolean;
}

const RoleContext = createContext<RoleContextType>({
  role: 'Owner',
  isOwner: true,
  canEdit: true,
  canDelete: true,
  ownerId: null,
  loading: false,
});

export function useRole() {
  return useContext(RoleContext);
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [role, setRole] = useState<TeamRole>('Owner');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }

    const checkRole = async () => {
      try {
        const { data } = await supabase!
          .from('team_members')
          .select('owner_id, role')
          .eq('user_id', user.id)
          .eq('status', 'Active')
          .maybeSingle();

        if (data) {
          setRole(data.role as TeamRole);
          setOwnerId(data.owner_id);
        } else {
          setRole('Owner');
          setOwnerId(null);
        }
      } catch {
        setRole('Owner');
        setOwnerId(null);
      } finally {
        setLoading(false);
      }
    };

    checkRole();
  }, [user]);

  const isOwner = role === 'Owner';
  const canEdit = role === 'Owner' || role === 'Manager';
  const canDelete = role === 'Owner';

  return (
    <RoleContext.Provider value={{ role, isOwner, canEdit, canDelete, ownerId, loading }}>
      {children}
    </RoleContext.Provider>
  );
}
