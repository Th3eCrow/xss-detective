// ==UserScript==
// @name XSS Detective
// @author John Garland
// @version 1.1
// @namespace http://userscripts.org/scripts/show/52430
// @description Tests a selected input field against known attack vectors.
// ==/UserScript==
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

var xssDetective = function() {
   // Options
   var showOnLoad = false;
   var toggleKey = '/';

   function Deferred() {
      this.callbacks = [];
      this.addCallback = function (callback, context) {
         this.callbacks.push({
            func : callback,
            scope : context,
            args : Array.prototype.slice.call(arguments, 2)
         });
         return this;
      };
      this.callback = function (result) {
         while (this.callbacks.length > 0) {
            var cb = this.callbacks.shift();
            if (typeof(result) !== 'undefined') {
               cb.args.unshift(result);
            }
            result = cb.func.apply(cb.scope, cb.args);
            if (result instanceof Deferred) {
               result.callbacks.push.apply(result.callbacks, this.callbacks);
               this.callbacks = [];
            }
         }
      };
      return true;
   }

   Function.prototype.bind = function(scope) {
      var self = this;
      return function() {
         return self.apply(scope, arguments);
      }
   }

   function randomString(length) {
      var rand = [];
      var min = ' '.charCodeAt(0);
      var max = '~'.charCodeAt(0);
      while (rand.length < length) {
         rand.push(String.fromCharCode(Math.floor(Math.random()*(max-min+1))+min));
      }
      return rand.join('');
   }

   function range() {
      var start = 0;
      var stop = 0;
      var step = 1;
      switch (arguments.length) {
         case 3:
            step = arguments[2];
         case 2:
            start = arguments[0];
         case 1:
            stop = arguments[1 % arguments.length];
      }
      var sequence = [];
      for (; start < stop; start += step) {
         sequence.push(start);
      }
      return sequence;
   }

   var detective = {

      buildToolbar:
      function() {
         var toolbar = document.createElement('div');
         toolbar.style.position = 'fixed';
         toolbar.style.left = '0px';
         toolbar.style.bottom = '0px';
         toolbar.style.width = '100%';
         toolbar.style.background = 'LightGray';
         toolbar.style.borderTop = '1px solid Gray';
         toolbar.style.color = 'Black';
         toolbar.style.overflow = 'hidden';
         toolbar.style.fontFamily = 'Tahoma, Sans'
         toolbar.style.fontSize = '0.8em';
         toolbar.hide = function() { this.style.display = 'none' };
         toolbar.show = function() { this.style.display = 'inline' };
         document.body.appendChild(toolbar);
         return toolbar;
      },

      createSelection:
      function(multiple, options, getAttributes) {
         var select = document.createElement('select');
         select.style.cssFloat = 'left';
         select.style.width = 'auto';
         select.style.border = '1px solid DarkGray';
         select.style.background = '#bbb';
         select.style.margin = '5px';
         select.style.color = 'Black';
         select.style.cursor = 'pointer';
         select.size = 2;
         select.multiple = multiple;
         for (var i = 0, len = options.length; i < len; i++) {
            var attributes = getAttributes(options[i]);
            var option = document.createElement('option');
            for (attribute in attributes) {
               option[attribute] = attributes[attribute];
            }
            select.appendChild(option);
         }
         select.hide = this.toolbar.hide;
         select.show = this.toolbar.show;
         this.toolbar.appendChild(select);
         return select;
      },

      buttonHover:
      function(e) {
         e.target.style.background = 'White';
      },

      buttonLeave:
      function(e) {
         e.target.style.background = '#bbb';
      },

      createButton:
      function(text, handler) {
         var button = document.createElement('div');
         button.style.cssFloat = 'left';
         button.style.width = 'auto';
         button.style.border = '1px solid DarkGray';
         button.style.background = '#bbb';
         button.style.margin = '9px 5px 9px 5px';
         button.style.padding = '5px';
         button.style.color = 'Black';
         button.style.cursor = 'pointer';
         button.textContent = text;
         button.addEventListener('mouseover', this.buttonHover, false);
         button.addEventListener('mouseout', this.buttonLeave, false);
         if (handler) {
            button.addEventListener('click', handler, false);
         }
         button.hide = this.toolbar.hide;
         button.show = this.toolbar.show;
         this.toolbar.appendChild(button);
         return button;
      },

      createCheckbox:
      function(title, handler) {
         var checkbox = document.createElement('input');
         checkbox.style.cssFloat = 'left';
         checkbox.style.width = 'auto';
         checkbox.style.background = '#bbb';
         checkbox.style.margin = '13px 5px 13px 5px';
         checkbox.style.padding = '5px';
         checkbox.style.color = 'Black';
         checkbox.type = 'checkbox';
         checkbox.title = title;
         if (handler) {
            checkbox.addEventListener('click', handler, false);
         }
         checkbox.hide = this.toolbar.hide;
         checkbox.show = this.toolbar.show;
         this.toolbar.appendChild(checkbox);
         return checkbox;
      },

      init:
      function(visible) {

         this.targets = [];
         this.targetEvents = {
            'mouseover' : this.hoverOn.bind(this),
            'mouseout' : this.hoverOff.bind(this),
            'focus' : this.targetSelected.bind(this)
         };
         this.cancel = this.cancelTarget.bind(this);

         this.tests = [];

         this.toolbar = this.buildToolbar();

         //this.addVector("Random String", randomString());

         this.createButton('Select input', this.chooseTarget.bind(this));

         this.createButton('Select all inputs', this.allTargetsSelected.bind(this));

         this.testSelection = this.createSelection(true, this.tests, function(test) {
               return {"text" : test.name, "value" : test.vector};
         });

         this.testAllCheckbox = this.createCheckbox('Select All Tests', function (e) {
               this.testSelection.disabled = e.currentTarget.checked;
         }.bind(this));

         this.detailSelection = this.createSelection(false, ["Description", "Vector"], function(option) {
               return {
                  "text" : option,
                  "title" : "Show "+option.toLowerCase()+" as test tooltip",
                  "value" : option,
                  "selected" : option == "Description"
               };
         });

         this.injectButton = this.createButton('Inject XSS test vector', this.injectXSS.bind(this));

         this.log = document.createElement('textarea');
         this.log.style.cssFloat = 'left';
         this.log.style.height = '35px';
         this.log.style.width = '25%';
         this.log.style.border = '1px solid DarkGray';
         this.log.style.background = '#bbb';
         this.log.style.margin = '5px';
         this.log.style.color = 'Black';
         this.log.readOnly = true;
         this.log.hide = this.toolbar.hide;
         this.log.show = this.toolbar.show;
         this.toolbar.appendChild(this.log);

         this.dimmer = document.createElement('div');
         this.dimmer.show = this.toolbar.show;
         this.dimmer.hide = this.toolbar.hide;
         this.dimmer.style.position = "fixed";
         this.dimmer.style.zIndex = 10;
         this.dimmer.style.left = "0px";
         this.dimmer.style.top = "0px";
         this.dimmer.style.height = "100%";
         this.dimmer.style.width = "100%";
         this.dimmer.style.backgroundColor = "black";
         this.dimmer.style.opacity = 0.8;
         this.dimmer.style.cursor = "crosshair";
         this.dimmer.hide();
         document.body.appendChild(this.dimmer);

         // Only add events after fields exist
         this.testSelection.addEventListener('change', this.updateTests.bind(this), false);
         this.testAllCheckbox.addEventListener('change', this.updateTests.bind(this), false);
         this.detailSelection.addEventListener('change', this.updateDetails.bind(this), false);

         // Hide these until a target is selected
         this.testSelection.hide();
         this.testAllCheckbox.hide();
         this.injectButton.hide();
         this.detailSelection.hide();
         this.log.hide();

         this.updateDetails();

         this.hidden = visible;
         this.toggle();
      },

      addVectors:
      function(vectors) {
         this.tests.push.apply(this.tests, vectors);
         for (var i = 0, len = vectors.length; i < len; i++) {
            var option = document.createElement('option');
            option.text = vectors[i].name;
            option.value = vectors[i].vector;
            this.testSelection.appendChild(option);
         }
         this.updateDetails();
      },

      isValidTarget:
      function(target) {
         return (target.type !== 'submit' &&
                 target.type !== 'reset' &&
                 target.type !== 'button');
      },

      chooseTarget:
      function(e) {
         if (this.targets.length > 0) {
            for (var i = 0, len = this.targets.length; i < len; i++) {
               this.hover(false, this.targets[i]);
            }
            this.targets = [];
            this.testSelection.hide();
            this.testAllCheckbox.hide();
            this.injectButton.hide();
            this.detailSelection.hide();
            this.log.hide();
         }
         var formsLength = document.forms.length;
         for (var i = 0; i < formsLength; i++) {
            form = document.forms[i];
            inputsLength = document.forms[i].elements.length;
            for (var j = 0; j < inputsLength; j++) {
               input = document.forms[i].elements[j];
               if (this.isValidTarget(input)) {
                  if (input.type === 'hidden') {
                     input.type = 'text';
                  }
                  if (input.style.position !== "absolute" ||
                      input.style.position !== "relative" ||
                      input.style.position !== "fixed") {
                     input.style.left = "0px";
                     input.style.top = "0px";
                     input.style.position = "relative";
                  }
                  input.disabled = false;
                  input.style.zIndex = 20;
                  input.style.cursor =  "crosshair";
                  for (var e in this.targetEvents) {
                     input.addEventListener(e, this.targetEvents[e], false);
                  }
               }
            }
         }
         this.toolbar.hide();
         this.dimmer.show();
         document.addEventListener('keypress', this.cancel, false);
      },

      cancelTarget:
      function(e) {
         var ESC = 27;
         if (e.keyCode === ESC) {
            this.targetSelected(null);
         }
      },

      targetSelected:
      function(e) {
         if (e) {
            this.targets.push(e.currentTarget);
         }
         var formsLength = document.forms.length;
         for (var i = 0; i < formsLength; i++) {
            form = document.forms[i];
            inputsLength = document.forms[i].elements.length;
            for (var j = 0; j < inputsLength; j++) {
               input = document.forms[i].elements[j];
               input.uniqueID = i + ';' + j;
               if (this.isValidTarget(input)) {
                  input.style.zIndex = "";
                  input.style.position = "static";
                  input.style.cursor = "auto";
                  for (var e in this.targetEvents) {
                     input.removeEventListener(e, this.targetEvents[e], false);
                  }
               }
            }
         }
         if (this.targets.length > 0) {
            for (var i = 0, len = this.targets.length; i < len; i++) {
               this.hover(true, this.targets[i]);
            }
            this.testSelection.show();
            this.testAllCheckbox.show();
            this.detailSelection.show();
            this.updateTests();
         }
         this.toolbar.show();
         this.dimmer.hide();
         document.removeEventListener('keypress', this.cancel, false);
      },

      allTargetsSelected:
      function(e) {
         var formsLength = document.forms.length;
         for (var i = 0; i < formsLength; i++) {
            form = document.forms[i];
            inputsLength = document.forms[i].elements.length;
            for (var j = 0; j < inputsLength; j++) {
               input = document.forms[i].elements[j];
               input.uniqueID = i + ';' + j;
               if (this.isValidTarget(input)) {
                  if (input.type === 'hidden') {
                     input.type = 'text';
                  }
                  this.targets.push(input);
                  this.hover(true, input);
               }
            }
         }
         if (this.targets.length > 0) {
            this.testSelection.show();
            this.testAllCheckbox.show();
            this.detailSelection.show();
            this.updateTests();
         } else {
            alert("No inputs found!");
         }
      },

      injectXSS:
      function(e) {
         if (this.targets.length > 0) {
            var selected = this.getSelectedTests();
            if (selected.length > 0) {
               this.passed = {};
               this.log.value = "";
               this.log.show();
               for (var i = 0, len = selected.length; i < len; i++) {
                  var testIndex = selected[i];
                  for (var j = 0, len2 = this.targets.length; j < len2; j++) {
                     var deferred = this.asyncSubmit(this.targets[j], this.tests[testIndex].vector);
                     deferred.addCallback(this.tests[testIndex].check);
                     deferred.addCallback(this.storeResult, this, this.targets[j], testIndex);
                     deferred.addCallback(this.logResult, this, this.targets[j], testIndex);
                     deferred.addCallback(this.updateResults, this, selected.length);
                  }
               }
            } else {
               alert("You need to select at least one test!");
            }
         } else {
            alert("You need to select an input first!");
         }
      },

      asyncSubmit:
      function(element, value) {
         if (typeof(arguments.callee.counter) === 'undefined') {
            arguments.callee.counter = 0;
         }
         var counter = arguments.callee.counter++;
         var form = element.form;
         var previous = form.target;
         var deferred = new Deferred();
         var iframe = document.createElement('iframe');
         iframe.style.display = "none";
         iframe.name = "XD_AJAX_LOL_"+counter;
         iframe.addEventListener('load', function (e) {
            if (this.contentDocument.body.firstChild !== null) {
               deferred.callback(this.contentDocument);
               document.body.removeChild(this);
               form.target = previous;
            }
         }, false);
         document.body.appendChild(iframe);
         form.target = iframe.name;
         if (element.type.match('select')) {
            var option = document.createElement('option');
            option.value = value;
            element.appendChild(option);
         }
         element.value = value;
         form.submit();
         if (element.type.match('select')) {
            element.removeChild(option);
         }
         form.reset();
         return deferred;
      },

      getSelectedTests:
      function() {
         var length = this.testSelection.length;
         if (this.testAllCheckbox.checked) {
            var selectedTests = range(length);
         } else {
            var selectedTests = [];
            var selectedIndex = this.testSelection.selectedIndex;
            for (var i = selectedIndex; this.testSelection.multiple && i >= 0 && i < length; i++) {
               if (this.testSelection[i].selected) {
                  selectedTests.push(i);
               }
            }
         }
         return selectedTests;
      },


      storeResult:
      function(passed, input, testIndex) {
         if (typeof(this.passed[input.uniqueID]) === 'undefined') {
            this.passed[input.uniqueID] = {};
         }
         this.passed[input.uniqueID][testIndex] = passed;
      },

      logResult:
      function(input, index) {
         this.log.value += input.name + " ";
         this.log.value += this.passed[input.uniqueID][index] ? "PASSED" : "FAILED";
         this.log.value += " test " + index + '\n';
      },

      updateResults:
      function(total) {
         for (var i = 0, len = this.targets.length; i < len; i++) {
            var target = this.targets[i].uniqueID;
            var passed = 0;
            var failed = 0;
            if (typeof(this.passed[target]) !== 'undefined') {
               for (var test in this.passed[target]) {
                  if (this.passed[target][test]) {
                     passed++;
                  } else {
                     failed++;
                  }
               }
               if (failed > 0) {
                  this.targets[i].style.outline = "solid Red";
               } else if (passed === total) {
                  this.targets[i].style.outline = "solid ForestGreen";
               }
            }
         }
      },

      updateTests:
      function(e) {
         var selected = this.getSelectedTests();
         if (selected.length == 0) {
            this.injectButton.hide();
         } else {
            this.injectButton.show();
         }
      },

      updateDetails:
      function(e) {
         var type = this.detailSelection.options[this.detailSelection.selectedIndex].value;
         for (var i = 0, len = this.tests.length; i < len; i++) {
            if (type === "Description") {
               this.testSelection[i].title = this.tests[i].description;
            } else {
               this.testSelection[i].title = this.tests[i].vector;
            }
         }
      },

      setShortcutKey:
      function(key) {
         this.shortcutKey = key.charCodeAt(0);
         document.addEventListener('keypress', this.checkShortcut.bind(this), false);
      },

      checkShortcut:
      function(e) {
         if (e.ctrlKey && e.which === this.shortcutKey) {
            this.toggle();
         }
      },

      hover:
      function(on, el) {
         el.style.outline = on ? "solid #fc0" : "";
      },

      hoverOn:
      function(e) {
         this.hover(true, e.currentTarget);
      },

      hoverOff:
      function(e) {
         this.hover(false, e.currentTarget);
      },

      toggle:
      function() {
         this.hidden = !this.hidden;
         if (this.hidden) {
            this.toolbar.hide();
         } else {
            this.toolbar.show();
         }
      },
   };

   detective.init(showOnLoad);
   detective.setShortcutKey(toggleKey);
   return { "addVectors" : detective.addVectors.bind(detective) };
}();

if (typeof(unsafeWindow) !== 'undefined') {
   unsafeWindow.xssDetective = xssDetective;
}
