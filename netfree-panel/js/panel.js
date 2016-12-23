(function() {
    var countNews = +"11";

    var unreadCount = countNews - (+localStorage['read-news'] || 0);

    var $unreadnews = $("#unread-news");

    $unreadnews.text(unreadCount);
    if (!unreadCount) $unreadnews.hide();


    $("#news-link").on('click', function() {
        localStorage['read-news'] = countNews;
    });
})();

var callbacks = {};

function emitMessage(name, data, callback, nodelete) {
    var token = makeToken(20);
    if (callback)
        callbacks[token] = callback;

    parent.postMessage({ token: token, name: name, data: data }, '*');
    if (callback && nodelete) {
        callback.nodelete = true;
        return function deleteCallback() {
            delete callbacks[token];
        };
    }
}

function inActionShow() {
    $("#in-action").addClass('active');
}

function inActionHide() {
    $("#in-action").removeClass('active');
}

function inSelect(type) {
    $(".in-select").hide();
    $("#in-select-" + type).show();
}

function makeToken(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < length; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

window.addEventListener("message", function(event) {

    if (!event.data) return;
    if (callbacks[event.data.token]) {
        var fn = callbacks[event.data.token];
        if (!fn.nodelete) delete callbacks[event.data.token];
        fn(null, event.data.data);
        return;
    }

}, false);

var selectImages = [];

function mouseenterImg(event) {
    event.preventDefault();
    if (event.target.tagName != "IMG" || event.target._selected) return;

    $(event.target).css('box-shadow', "0px 0px 20px #0056FF");
    $(event.target).css('transition', "box-shadow 100ms ease-in-out");
}

function mouseleaveImg(event) {
    event.preventDefault();
    if (event.target.tagName != "IMG" || event.target._selected) return;

    $(event.target).css('box-shadow', "");
}

function clickImg(event) {
    event.preventDefault();
    if (event.target.tagName != "IMG") return;

    if (event.target._selected) {
        $(event.target).css('box-shadow', "");
        var index = selectImages.indexOf(event.target);
        if (index >= 0) selectImages.splice(index, 1);
    } else {
        $(event.target).css('box-shadow', "0px 0px 20px #FF0000");
        selectImages.push(event.target);
    }



    event.target._selected = !event.target._selected;
}

var deleteSelectCb = false;
$("#report-image").on('click', function() {

    $("#select-count").text(0);
    emitMessage('start-select', {}, function(err, data) {});

    deleteSelectCb = emitMessage('on-selected', {}, function(err, data) {
        $("#select-count").text(data.count);
    }, true);

    inSelect("image");
    inActionShow();

});

$("#report-text").on('click', function() {
    inSelect("text");
    inActionShow();
});

function stopSelect() {
    if (deleteSelectCb) deleteSelectCb();
    emitMessage('stop-select', {}, function(err, data) {});
    inActionHide();
}

$(".cancel").on('click', function() {
    stopSelect();
});




$("#send-image").on('click', function() {

    emitMessage('report-selected', {}, function(err, data) {
        stopSelect();
    });

    emitMessage('get-selected', {}, function(err, data) {
        var list = data.list;

        console.log(list);

        $.ajax({
            type: 'POST',
            url: '/image/feedback',
            data: JSON.stringify({ list: list }),
            contentType: "application/json; charset=utf-8",
            dataType: "json"
        }).done(function(data) {
            if (data.success) {

            }
        });

        stopSelect();
    });

});

$("#send-text").on('click', function() {

    emitMessage('get-top.location.href', {}, function(err, data) {
        var url = data.href;
        var content = $("#bad-text-content").val();

        $.ajax({
            type: 'POST',
            url: '/feedback/ajax/link-report',
            data: JSON.stringify({ url: url, content: content }),
            contentType: "application/json; charset=utf-8",
            dataType: "json"
        }).done(function(data) {
            if (data && data.ticket) {
                window.open("/user#/tickets/ticket/" + data.ticket, '_blank');
            }
            inActionHide();
        });
    });

});

$("#refresh-images").on('click', function() {
    emitMessage("refresh-images", {}, function() {});
});

var timeLoad = Date.now();

var oneSec = 1000;
var oneMin = 60 * oneSec;
var oneHour = 60 * oneMin;

function updateTimeCheckImages() {
    $.ajax('https://netfree.link/ajax/check-images-time').always(function(data) {
        var time = data && +data.time;
        var text = "";
        if (time > oneHour) {
            text = "יותר משעה";
        } else if (time > oneMin) {
            text = Math.round(time / oneMin) + " " +
                "דקות";
        } else if (time > 0) {
            text = Math.round(time / oneSec) + " " +
                "שניות";
        }

        if (text) {
            text = "עכשיו נבדקות התמונות שנשלחו לפני " + text;
        } else {
            text = "כעת אין תמונות שנבדקות";
        }
        $("#check-images-time").text(text);

        //setTimeout(updateTimeCheckImages, 10000);
    });
}
updateTimeCheckImages();
//setTimeout(updateTimeCheckImages,3000);

$("#upload-all-images-for-check").on('click', function() {
    emitMessage("upload-all-images-for-check", {}, function(err, data) {});
});


var queryReqex = /(\?.*)?$/;
var nfoptRegex = /(?:\?)?&~nfopt\(([^\/]+)\)$/;

var imageMapValue = {};

var processImagesCount = 0;

function processImages() {
    getNewImagesImages(function() {
        checkImages(function(err, haveImages) {
            setTimeout(processImages, 3000);
        });
    });
}

processImages();

function getNewImagesImages(cb) {
    emitMessage("get-images-list", {}, function(err, data) {
        var list = data.list;

        var checkImagesList = [];

        list.forEach(function(link) {
            var linkobj = imageMapValue[link] = imageMapValue[link] || {};

            if (!linkobj.hash) {
                var hashObj = new jsSHA("SHA-1", "TEXT");
                hashObj.update(link);
                linkobj.hash = hashObj.getHash("HEX").substr(0, 10);
            } else {
                return;
            }

            checkImagesList.push(linkobj.hash);
        });

        if (!checkImagesList.length)
            return cb();


        $.ajax({
            type: "POST",
            url: "/nf/image-value/get-cache",
            data: JSON.stringify({ list: checkImagesList }),
            contentType: "application/json; charset=utf-8",
            dataType: "json"
        }).always(function(data) {
            if (data && data.list) {
                list.forEach(function(link) {
                    var linkobj = imageMapValue[link] = imageMapValue[link] || {};
                    var o = data.list[linkobj.hash] || {};
                    linkobj.lastValue = o.v;
                    linkobj.checkHash = o.h;
                });
            }
            cb();
        });
    });
}

function checkImages(cb) {

    var paramRefresh = "&~nfopt(r=" + Math.floor(Math.random() * 0xffff).toString(16) + ")";

    var haveImages = false;

    async.forEachOf(imageMapValue, function(link, key, callback) {
        if (link.lastValue !== 0) return callback();

        if (!link.scanCount || (link.scanCount % 2 === 0)) {
            haveImages = true;
            link.scanCount = 1;
            return callback();
        }

        if (link.scanCount > 20) return callback();
        link.scanCount++;

        $.ajax({
            url: '/nf/image-value/check/' + link.checkHash + "/" + Math.random(),
        }).always(function(data) {
            var value = data && data.value
            link.lastValue = value;
            if (value !== 0) {
                var newSrc = key.replace(nfoptRegex, '').replace(queryReqex, function(all, start) {
                    return (start || '?') + paramRefresh;
                });
                emitMessage("refresh-image", { src: key, newSrc: newSrc }, function() {});
            } else {
                haveImages = true;
            }
            callback();
        });
    }, function() {
        cb(null, haveImages);
    });
}
