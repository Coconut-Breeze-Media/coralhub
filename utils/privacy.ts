export type PrivacyOption = 'Public' | 'Only Me' | 'My Friends' | 'Members';

export function toApiPrivacy(p: PrivacyOption): 'public' | 'friends' | 'onlyme' | 'groups' {
  switch (p) {
    case 'Public':   return 'public';
    case 'Only Me':  return 'onlyme';
    case 'My Friends': return 'friends';
    case 'Members':  return 'groups'; // or 'loggedin' if that’s your setup
    default:         return 'public';
  }
}