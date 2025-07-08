// Digital clock
function updateClock() {
  var now = new Date();
  var hours = now.getHours();
  var minutes = now.getMinutes();
  var seconds = now.getSeconds();

  var timeString = formatTime(hours) + ":" + formatTime(minutes) + ":" + formatTime(seconds);
  document.getElementById("digital-clock").textContent = timeString;
}

function formatTime(time) {
  return time.toString().padStart(2, '0');
}

setInterval(updateClock, 1000);

// Calendar
var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
var calendarElement = document.getElementById("calendar");

function updateCalendar() {
  var now = new Date();
  var dateString = now.toLocaleDateString(undefined, options);

  calendarElement.textContent = dateString;
}

updateCalendar();


document.getElementById("party-button").addEventListener("click", partyPopper);

function partyPopper() {
  var confettiContainer = document.getElementById("confetti-container");

  for (var i = 0; i < 1000; i++) {
    var confetti = document.createElement("div");
    confetti.classList.add("confetti");
    confetti.style.left = Math.random() * 100 + "vw";
    confetti.style.animationDuration = Math.random() * 2 + 3 + "s";
    confetti.style.animationDelay = Math.random() * 2 + "s";
    confetti.style.transform = "rotate(" + Math.random() * 360 + "deg)";
    confettiContainer.appendChild(confetti);
  }

  setTimeout(clearConfetti, 10000);
}

function clearConfetti() {
  var confettiContainer = document.getElementById("confetti-container");
  confettiContainer.innerHTML = "";
}