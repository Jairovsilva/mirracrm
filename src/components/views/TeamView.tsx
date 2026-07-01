'use client';

import { useTranslation } from '@/src/lib/useTranslation';
import { useCRMStore } from '@/src/store/crmStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Mail, Crown, User } from 'lucide-react';

export function TeamView() {
  const { t } = useTranslation();
  const registeredUsers = useCRMStore((s) => s.registeredUsers);
  const currentUser = useCRMStore((s) => s.currentUser);
  const leads = useCRMStore((s) => s.leads);

  const companyUsers = registeredUsers.filter(
    (u) => u.empresa === currentUser?.empresa
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1200px] mx-auto animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">{t.nav.team}</h1>
        <p className="text-sm text-muted-foreground mt-1">{companyUsers.length} membros</p>
      </div>

      {companyUsers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">{t.common.noData}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {companyUsers.map((user) => {
            const userLeads = leads.filter((l) => l.userId === user.id);
            const isAdmin = user.role === 'admin_principal';
            return (
              <Card key={user.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg shrink-0">
                      {user.email[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-semibold text-sm truncate">{user.email.split('@')[0]}</h3>
                        {isAdmin ? (
                          <Crown className="w-3.5 h-3.5 text-warning shrink-0" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3" />
                        {user.email}
                      </p>
                      <span className={`inline-block mt-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isAdmin ? 'bg-warning/15 text-warning' : 'bg-secondary text-muted-foreground'
                      }`}>
                        {user.role.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Leads</p>
                      <p className="font-semibold">{userLeads.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Empresa</p>
                      <p className="font-semibold">{user.empresa}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
