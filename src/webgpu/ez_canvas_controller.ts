/* The controller can register callbacks for various events on a canvas:
 *
 * mousemove: function(prevMouse, curMouse, evt)
 *     receives both regular mouse events, and single-finger drags (sent as a left-click),
 *
 * press: function(curMouse, evt)
 *     receives mouse click and touch start events
 *
 * wheel: function(amount)
 *     mouse wheel scrolling
 */
export class Controller {
    public mousemove : ((prevMouse : number[], curMouse : number[], evt : MouseEvent) => void) | null;
    public press : ((curMouse : number[], evt : MouseEvent) => void) | null;
    public wheel : ((amount : number) => void) | null;

    constructor()
    {
        this.mousemove = null;
        this.press = null;
        this.wheel = null;
    }

    registerForCanvas(canvas : HTMLCanvasElement)
    {
        let prevMouse : number[] | null = null;
        const self = this;
        canvas.addEventListener("mousemove", function(evt : MouseEvent) {
            evt.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const curMouse = [evt.clientX - rect.left, evt.clientY - rect.top];
            if (!prevMouse) {
                prevMouse = [evt.clientX - rect.left, evt.clientY - rect.top];
            } else if (self.mousemove) {
                self.mousemove(prevMouse, curMouse, evt);
            }
            prevMouse = curMouse;
        });

        canvas.addEventListener("mousedown", function(evt : MouseEvent) {
            evt.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const curMouse = [evt.clientX - rect.left, evt.clientY - rect.top];
            if (self.press) {
                self.press(curMouse, evt);
            }
        });

        canvas.addEventListener("wheel", function(evt) {
            evt.preventDefault();
            if (self.wheel) {
                self.wheel(-evt.deltaY);
            }
        });

        canvas.oncontextmenu = function(evt) {
            evt.preventDefault();
        };
    }
}

