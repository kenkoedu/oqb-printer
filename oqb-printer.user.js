// ==UserScript==
// @name         OQB Printer
// @namespace    https://github.com/kenkoedu
// @version      0.2
// @description  Print and download OQB assessments on edcity.hk.
// @updateURL    https://raw.githubusercontent.com/kenkoedu/oqb-printer/main/oqb-printer.user.js
// @downloadURL  https://raw.githubusercontent.com/kenkoedu/oqb-printer/main/oqb-printer.user.js
// @grant        GM_xmlhttpRequest
// @match        https://oqb.hkedcity.net/*
// @match        https://oqb.edcity.hk/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=hkedcity.net
// @require      https://code.jquery.com/jquery-4.0.0.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jQuery.print/1.6.2/jQuery.print.min.js
// @require      https://html2canvas.hertzen.com/dist/html2canvas.min.js
// ==/UserScript==

const hideBtn = (state) => {
    const btn = document.createElement("button");
    btn.innerHTML = state ? "SHOW ANSWER" : "HIDE ANSWER";
    btn.id = "hide-ans-btn"
    btn.onclick = () => {
        state = !state
        toggleAns(state)
        btn.innerHTML = state ? "SHOW ANSWER" : "HIDE ANSWER";
    }
    return btn
}

const makePrintDiv = (columns) => {
    const printDiv = document.createElement("div")
    printDiv.id = "print-div";
    printDiv.appendChild(document.createElement("h1")).innerHTML = $("#paperTitle").val();
    const fields = ["姓名", "班別", "學號", "日期"];
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    fields.forEach(field => {
        const fieldDiv = document.createElement("div");
        fieldDiv.innerHTML = `${field}: ____________________`;
        header.appendChild(fieldDiv);
    })
    printDiv.appendChild(header);
    document.body.appendChild(printDiv);
    const wrapper = $(`<div></div>`).css({ columns: columns })
    $(".oqb-player-container>div").each((i, el) => {
        const card = $(`<div><div>${i + 1}.</div> </div>`).css({ "break-inside": "avoid" });
        const clone = $(el).clone();
        const qImg = clone.find(".oqb-player-question-body img").first().css({ display: "block" })
        columns === 2 && qImg.css({ "max-width": "500px" })
        const choiceImgs = clone.find(".oqb-player-ci-simple-choice-text img")
        const cardContent = $(`<div></div>`)
        cardContent.append(qImg)
        const ol = $("<ol type='A'></ol>")
        choiceImgs.each((j, img) => {
            const li = $(`<li></li>`)
            li.append($(img))
            ol.append(li)
        })
        cardContent.append(ol)
        card.append(cardContent);
        wrapper.append(card);
    })
    $("#print-div").append(wrapper);
    $("#print-div").print({
        globalStyles: true,
    })
    $("#print-div").remove();
}

const printBtnOne = () => {
    const btn = document.createElement("button");
    btn.innerHTML = "Print 1 Column"
    btn.id = "print-btn"
    btn.onclick = () => {
        console.log("clicked")
        toggleAns(true)
        $(".print-disable-area").removeClass("print-disable-area");
        $(".oqb-teacher-edit-paper-question-item-card-info").addClass("print-disable-area");
        $(".oqb-player-container>img").addClass("print-disable-area");
        $(".oqb-question-item-card").css("page-break-inside", "avoid");
        makePrintDiv(1);
        toggleAns(false)
    }
    return btn
}

const printBtnTwo = () => {
    const btn = document.createElement("button");
    btn.innerHTML = "Print 2 Columns"
    btn.id = "print-btn"
    btn.onclick = () => {
        console.log("clicked")
        toggleAns(true)
        $(".print-disable-area").removeClass("print-disable-area");
        $(".oqb-teacher-edit-paper-question-item-card-info").addClass("print-disable-area");
        $(".oqb-player-container>img").addClass("print-disable-area");
        $(".oqb-question-item-card").css("page-break-inside", "avoid");
        makePrintDiv(2);
        toggleAns(false)
    }
    return btn
}


const showOverlay = (text) => {
    if (document.getElementById("progress-overlay")) {
        document.getElementById("progress-overlay").innerHTML = text;
        return;
    }
    const overlay = document.createElement("div");
    overlay.id = "progress-overlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0,0,0,0.5)";
    overlay.style.zIndex = "10000";
    overlay.style.display = "flex";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.color = "white";
    overlay.style.fontSize = "2em";
    overlay.innerHTML = text;
    document.body.appendChild(overlay);
}

const hideOverlay = () => {
    const overlay = document.getElementById("progress-overlay");
    if (overlay) {
        overlay.remove();
    }
}

const downloadBtn = () => {
    const btn = document.createElement("button");
    btn.innerHTML = "Download"
    btn.id = "download-btn"
    btn.onclick = async () => {
        showOverlay("Starting Download...");
        try {
            console.log("Download clicked");
            const elements = $(".oqb-player-container>div").toArray();

            // Process ONE element (div) at a time
            for (const [i, el] of elements.entries()) {
                showOverlay(`Processing ${i + 1} of ${elements.length}...`);

                // 1. Find images ONLY inside this specific element
                const images = el.querySelectorAll('img.oqb-player-content-images');
                const originalSrcMap = new Map(); // Store original URLs for cleanup

                // 2. Convert images for THIS element to Base64 sequentially
                for (const img of images) {
                    const originalSrc = img.src;

                    // Skip if already Base64
                    if (!originalSrc || originalSrc.startsWith('data:')) continue;

                    try {
                        const base64Data = await getImageBase64(originalSrc);
                        originalSrcMap.set(img, originalSrc); // Save the original URL
                        img.src = base64Data; // Inject the heavy Base64 string
                    } catch (err) {
                        console.error(`Failed to fetch image: ${originalSrc}`, err);
                    }
                }

                // Yield to the main thread briefly so the UI/Overlay can update
                await new Promise(resolve => setTimeout(resolve, 100));

                // 3. Capture the canvas and trigger download
                await captureOne(el, i + 1);

                // 4. AGGRESSIVE CLEANUP (Crucial for memory)
                // We must remove the Base64 strings from the DOM immediately
                for (const [img, originalSrc] of originalSrcMap.entries()) {
                    img.src = originalSrc; // Revert to the standard URL
                }
                originalSrcMap.clear(); // Drop the map references for the garbage collector

                // Pause again to prevent the browser from locking up between heavy canvas renders
                await new Promise(resolve => setTimeout(resolve, 150));
            }

            showOverlay("Done!");
            setTimeout(hideOverlay, 1500); // Briefly show "Done!" then hide

        } catch (error) {
            console.error(error);
            showOverlay("Error occurred!");
            setTimeout(hideOverlay, 2000);
        }
    }
    return btn;
}

async function getImageBase64(url) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            responseType: "blob", // This is the secret sauce
            onload: function (response) {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(response.response); // Converts blob to base64 data URL
            },
            onerror: function (err) {
                reject(err);
            }
        });
    });
}

async function captureOne(el, fileName) {
    html2canvas(el, {
        allowTaint: false,
        useCORS: true,
    })
        .then(function (canvas) {
            // It will return a canvas element
            let image = canvas.toDataURL("image/png", 0.95).replace("image/png", "image/octet-stream");
            var a = document.createElement('a');
            a.href = image;
            a.download = fileName + '.png';
            a.click();
        })
        .catch((e) => {
            // Handle errors
            console.log(e);
        });
}

const toggleAns = (state) => {
    const s = state ? "hidden" : "";
    Object.values(document.getElementsByClassName("oqb-player-ci-checkerbox")).forEach(box => { box.hidden = s })
    Object.values(document.getElementsByClassName("radio")).forEach(radio => { radio.hidden = s })
    Object.values(document.getElementsByClassName("oqb-players-solution-box")).forEach(box => { box.hidden = s })
}

(async function () {
    'use strict';
    console.log("Starting userscript");
    const state = false; //false = hide; false = show
    const checkUI = setInterval(() => {
        if (!window.location.href.includes('/teacher/')) return;
        const topbar = document.getElementsByClassName("oqb_teacher_topbar");
        if (document.getElementById("hide-ans-btn") == null && topbar.length) {
            topbar[0].append(hideBtn(state))
            topbar[0].append(printBtnOne())
            topbar[0].append(printBtnTwo())
            topbar[0].append(downloadBtn())
        }
    }, 1000)

})();
