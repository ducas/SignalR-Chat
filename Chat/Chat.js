﻿/// <reference path="../../Scripts/jquery-1.6.2.js" />
/// <reference path="../../Scripts/jQuery.tmpl.js" />
/// <reference path="../../Scripts/jquery.cookie.js" />

$(function () {
    var chat = $.connection.chat;

    if (Modernizr.geolocation) {
        navigator.geolocation.getCurrentPosition(function (position) {
            chat.latitude = position.coords.latitude;
            chat.longitude = position.coords.longitude;
        });
    }

    $.fn.isNearTheEnd = function () {
        return this[0].scrollTop + this.height() >= this[0].scrollHeight;
    };

    $.fn.resizeMobileContent = function () {
        if ($.mobile) {
            this.find('embed')
                .attr('width', 250)
                .attr('height', 202);
        }
        return this;
    };

    function clearMessages() {
        $('#messages').html('');
    }

    function refreshMessages() { refreshList($('#messages')); }

    function clearUsers() {
        $('#users').html('');
    }

    function refreshUsers() { refreshList($('#users')); }

    function refreshList(list) {
        if (list.is('.ui-listview')) {
            list.listview('refresh');
        }
    }

    function addMessage(content, type) {
        var nearEnd = $('#messages').isNearTheEnd();
        var e = $('<li/>').html(content).appendTo($('#messages'));

        refreshMessages();

        if (type) {
            e.addClass(type);
        }

        updateUnread();
        if (nearEnd) {
            scrollTo(e[0]);
        }
        return e;
    }

    function scrollTo(e) {
        e.scrollIntoView();
    }

    chat.joinRoom = function (room) {
        clearMessages();
        clearUsers();

        chat.getUsers()
            .done(function (users) {
                $.each(users, function () {
                    chat.addUser(this, true);
                });

                refreshUsers();

                $('#new-message').focus();
            });

        chat.getRecentMessages()
            .done(function (messages) {
                $.each(messages, function () {
                    chat.addMessage(this.Id, this.User, this.Content, this.WhenFormatted, true);
                });
            });

        addMessage('Entered ' + room, 'notification');
    };


    chat.markInactive = function (user) {
        var id = 'u-' + user.Id;
        $('#' + id).fadeTo('slow', 0.5);
    };

    chat.updateActivity = function (user) {
        var id = 'u-' + user.Id;
        $('#' + id).fadeTo('slow', 1);
    };

    chat.showRooms = function (rooms) {
        addMessage('<h3>Rooms</h3>');
        if (!rooms.length) {
            addMessage('No rooms available', 'notification');
        }
        else {
            $.each(rooms, function () {
                addMessage(this.Name + ' (' + this.Count + ')');
            });
        }
        addMessage('<br/>');
    };

    chat.addMessageContent = function (id, content) {
        var nearEnd = $('#messages').isNearTheEnd();

        var e = $('#m-' + id).append(content)
                             .resizeMobileContent();

        refreshMessages();
        updateUnread();
        if (nearEnd) {
            scrollTo(e[0]);
        }
    };

    chat.addMessage = function (id, user, message, when, noScroll) {
        var data = {
            name: user.Name,
            hash: user.Hash,
            message: message,
            id: id,
            when: when
        };

        var nearEnd = $('#messages').isNearTheEnd();
        var e = $('#new-message-template').tmpl(data)
                                          .appendTo($('#messages'))
                                          .resizeMobileContent();
        refreshMessages();

        updateUnread();

        if (!noScroll && nearEnd) {
            scrollTo(e[0]);
        }
    };

    chat.addUser = function (user, exists) {
        var id = 'u-' + user.Id;
        if (document.getElementById(id)) {
            return;
        }

        var data = {
            name: user.Name,
            hash: user.Hash,
            id: user.Id
        };

        var e = $('#new-user-template').tmpl(data)
                                       .appendTo($('#users'));

        refreshUsers();

        if (!exists && this.name !== user.Name) {
            addMessage(user.Name + ' just entered ' + this.room, 'notification');
            e.hide().fadeIn('slow');
        }

        updateCookie();
    };

    chat.changeUserName = function (oldUser, newUser) {
        $('#u-' + oldUser.Id).replaceWith(
                $('#new-user-template').tmpl({
                    name: newUser.Name,
                    hash: newUser.Hash,
                    id: newUser.Id
                })
        );

        refreshUsers();

        if (newUser.Name === this.name) {
            addMessage('Your name is now ' + newUser.Name, 'notification');
            updateCookie();
        }
        else {
            addMessage(oldUser.Name + '\'s nick has changed to ' + newUser.Name, 'notification');
        }
    };

    chat.showCommands = function (commands) {
        addMessage('<h3>Help</h3>');
        $.each(commands, function () {
            addMessage(this.Name + ' - ' + this.Description);
        });
        addMessage('<br />');
    };

    chat.sendMeMessage = function (name, message) {
        addMessage('*' + name + ' ' + message, 'notification');
    };

    chat.sendPrivateMessage = function (from, to, message) {
        addMessage('<emp>*' + from + '*</emp> ' + message, 'pm');
    };

    chat.leave = function (user) {
        if (this.id != user.Id) {
            $('#u-' + user.Id).fadeOut('slow', function () {
                $(this).remove();
            });

            refreshUsers();

            addMessage(user.Name + ' left ' + this.room, 'notification');
        }
    };

    $('#send-message').submit(function () {
        var command = $('#new-message').val();

        if (command) {
            chat.send(command)
            .fail(function (e) {
                addMessage(e, 'error');
            });

            $('#new-message').val('');
            $('#new-message').focus();
        }

        return false;
    });

    $(window).blur(function () {
        chat.focus = false;
    });

    $(window).focus(function () {
        chat.focus = true;
        chat.unread = 0;
        document.title = 'SignalR Chat';
    });

    function updateUnread() {
        if (!chat.focus) {
            if (!chat.unread) {
                chat.unread = 0;
            }
            chat.unread++;
        }
        updateTitle();
    }

    function updateTitle() {
        if (chat.unread == 0) {
            document.title = 'SignalR Chat';
        }
        else {
            document.title = 'SignalR Chat (' + chat.unread + ')';
        }
    }

    function updateCookie() {
        $.cookie('userid', chat.id, { path: '/', expires: 30 });
    }

    addMessage('Welcome to the SignalR IRC clone', 'notification');
    addMessage('Type /help to see the list of commands', 'notification');

    $('#new-message').val('');
    $('#new-message').focus();

    $.connection.hub.start(function () {
        chat.join()
            .done(function (success) {
                if (success === false) {
                    $.cookie('userid', '');
                    addMessage('Choose a name using "/nick nickname".', 'notification');
                }
            });
    });
});