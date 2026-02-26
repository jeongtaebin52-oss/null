/**
 * §31.8 알림 메시지 템플릿: {title}, {visits_today}, {visits_yesterday} 등 변수 치환.
 */
export function substituteAlertTemplate(
  template: string,
  vars: {
    title?: string;
    visits_today?: number;
    visits_yesterday?: number;
    start?: string;
    end?: string;
    clicks?: number;
    leaves?: number;
    deploy_url?: string;
  }
): string {
  let out = template;
  if (vars.title != null) out = out.replace(/\{title\}/g, String(vars.title));
  if (vars.visits_today != null) out = out.replace(/\{visits_today\}/g, String(vars.visits_today));
  if (vars.visits_yesterday != null) out = out.replace(/\{visits_yesterday\}/g, String(vars.visits_yesterday));
  if (vars.start != null) out = out.replace(/\{start\}/g, String(vars.start));
  if (vars.end != null) out = out.replace(/\{end\}/g, String(vars.end));
  if (vars.clicks != null) out = out.replace(/\{clicks\}/g, String(vars.clicks));
  if (vars.leaves != null) out = out.replace(/\{leaves\}/g, String(vars.leaves));
  if (vars.deploy_url != null) out = out.replace(/\{deploy_url\}/g, String(vars.deploy_url));
  return out;
}
