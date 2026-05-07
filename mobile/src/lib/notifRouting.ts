import type { Router } from 'expo-router';

export interface NotifRouteData {
  screen?:      string;
  job_id?:      string;
  provider_id?: string;
  notif_id?:    string;
  request_id?:  string;
  contract_id?: string;
  type?:        string;
}

export function handleNotifTap(data: NotifRouteData, router: Router) {
  const { screen, job_id, provider_id, contract_id } = data;

  switch (screen) {
    // Provider: job commit confirmation request
    case 'provider_confirm':
      if (job_id) router.push({ pathname: '/provider-confirm', params: { job_id } } as any);
      else        router.push('/(provider)/jobs' as any);
      break;

    // Client: new request / bids feed
    case 'new-request': {
      const href = data.notif_id
        ? `/(client)/new-request?notif_id=${data.notif_id}`
        : '/(client)/new-request';
      router.push(href as any);
      break;
    }

    // Provider: feed / urgent / bid rejection
    case 'urgent':
    case 'provider_feed':
      router.push('/(provider)' as any);
      break;

    // Provider: specific profile page (for sharing / admin links)
    case 'provider-profile':
      if (provider_id) router.push({ pathname: '/provider-profile', params: { provider_id } } as any);
      break;

    // Client: home tab
    case 'home':
      router.push('/(client)' as any);
      break;

    // Support thread
    case 'support_thread':
      if (job_id) router.push({ pathname: '/support-thread', params: { id: job_id } } as any);
      break;

    // Client: my requests list
    case 'my_requests':
      router.push('/(client)/requests' as any);
      break;

    // Client: jobs tab (confirm code received)
    case '/(client)/jobs':
      router.push('/(client)/jobs' as any);
      break;

    // Provider: jobs tab (bid accepted / job confirmed / job rated)
    case '/(provider)/jobs':
      router.push('/(provider)/jobs' as any);
      break;

    // Provider: profile tab (contract bid accepted, subscription info)
    case '/(provider)/profile':
      router.push('/(provider)/profile' as any);
      break;

    // Provider: contract feed
    case 'contract_feed':
      router.push('/(provider)' as any);
      break;

    // Subscribe / upgrade screen
    case 'subscribe':
      router.push('/subscribe' as any);
      break;

    default:
      // Fallback: navigate to the screen path directly if it looks like a route
      if (screen?.startsWith('/') || screen?.startsWith('(')) {
        router.push(screen as any);
      }
      break;
  }
}
