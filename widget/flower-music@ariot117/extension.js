import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Indicator} from './ui/indicator.js';

export default class FlowerMusicExtension extends Extension {
    enable() {
        this.indicator = new Indicator();
        Main.panel.addToStatusArea(this.uuid, this.indicator, 1, 'left');
    }

    disable() {
        this.indicator?.destroy();
        this.indicator = null;
    }
}
