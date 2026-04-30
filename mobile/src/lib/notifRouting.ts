import type { Router } from 'expo-router';

export interface NotifRouteData {
  screen?:      string;
  job_id?:      string;
  provider_id?: string;
  notif_id?:    string;
  request_id?:  string;
}

export function handleNotifTap(data: NotifRouteData, router: Router) {
  const { screen, job_id, provider_id } = data;

  if (screen === 'provider_confirm' && job_id) {
    router.push({ pathname: '/provider-confirm', params: { job_id } } as any);
  } else if (screen === 'new-request') {
    const href = data.notif_id
      ? `/(client)/new-request?notif_id=${data.notif_id}`
      : '/(client)/new-request';
    router.push(href as any);
  } else if (screen === 'urgent' || screen === 'provider_feed') {
    router.push('/(provider)' as any);
  } else if (screen === 'provider-profile' && provider_id) {
    router.push({ pathname: '/provider-profile', params: { provider_id } } as any);
  } else if (screen === 'home') {
    router.push('/(client)' as any);
  } else if (screen === 'support_thread' && job_id) {
    router.push({ pathname: '/support-thread', params: { id: job_id } } as any);
  } else if (screen === 'my_requests') {
    router.push('/(client)/requests' as any);
  }
}
