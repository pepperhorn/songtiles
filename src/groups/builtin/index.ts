import { registerGroupType } from '../registry';
import { CHORD_GROUP } from './chord';
import { ARP_GROUP } from './arp';

registerGroupType(CHORD_GROUP);
registerGroupType(ARP_GROUP);
